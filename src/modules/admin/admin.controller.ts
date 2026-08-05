import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator';
import { sendResponse } from '../../common/utils/response.util';
import { UserRole } from '../users/enums/user-role.enum';
import { ReconciliationService } from '../wallets/reconciliation.service';
import { AdminService } from './admin.service';
import { RevenueQueryDto } from './dto/revenue.query.dto';
import { StatsOverviewResponseDto } from './dto/stats-overview-response.dto';
import { MasterWalletGasService } from './master-wallet-gas.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly reconciliation: ReconciliationService,
    private readonly masterWalletGas: MasterWalletGasService,
  ) {}

  @Get('test')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Smoke-test admin authorization',
    description:
      'Returns a fixed payload if the caller holds an admin/super_admin role. ' +
      'Used to verify the Roles guard is wired up.',
  })
  @ApiOkResponse({
    description: 'Admin access granted.',
    schema: {
      example: {
        status: true,
        message: 'Success',
        data: { message: 'Admin access granted' },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Caller is not an admin.' })
  testAdminAccess() {
    return { message: 'Admin access granted' };
  }

  @Get('metrics/dashboard')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get admin dashboard overview stats' })
  @ApiOkResponse({
    description: 'Dashboard overview stats.',
    schema: {
      example: {
        status: true,
        message: 'Success',
        data: {
          users: { total: 1200, active: 1150, inactive: 50 },
          pendingKyc: 8,
          volume: 45230.75,
          masterWallet: 98765.43,
        },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Caller is not an admin.' })
  async getStatsOverview(): Promise<StatsOverviewResponseDto> {
    return this.adminService.getStatsOverview();
  }

  @Get('revenue')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Revenue & transaction totals over a period (admin)',
    description:
      'Aggregates successful, non-sweep transactions over an optional ' +
      'created_at window (from/to; omit both for all-time). Returns the total ' +
      'transaction count, total volume, and fee revenue (SUM of fees — today ' +
      'entirely from withdrawal fees, since transfers and deposits are free).',
  })
  @ApiOkResponse({
    description: 'Revenue summary.',
    schema: {
      example: {
        status: true,
        message: 'Revenue summary',
        data: {
          from: '2026-07-01',
          to: '2026-07-31',
          totalTransactions: 342,
          totalVolume: '48210.500000',
          feeRevenue: '512.750000',
        },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Caller is not an admin.' })
  async getRevenue(@Query() query: RevenueQueryDto) {
    const summary = await this.adminService.getRevenue(query.from, query.to);
    return sendResponse(
      { from: query.from ?? null, to: query.to ?? null, ...summary },
      'Revenue summary',
    );
  }

  @Get('reconciliation')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Daily reconciliation snapshot (admin)',
    description:
      'Computes the custody invariant on demand: Σ user ledger balances ' +
      '(liabilities) vs master-wallet USDC + unswept deposit-address USDC ' +
      '(custody). `healthy` is true when liabilities ≤ custody. Read-only — ' +
      'never moves money. Backs the admin master-wallet screen.',
  })
  @ApiOkResponse({
    description: 'Reconciliation result.',
    schema: {
      example: {
        status: true,
        message: 'Reconciliation computed',
        data: {
          asset: 'USDC',
          liabilities: '1250.000000',
          masterBalance: '1200.000000',
          unsweptBalance: '75.000000',
          custody: '1275.000000',
          difference: '25.000000',
          healthy: true,
          checkedAt: '2026-07-30T00:00:00.000Z',
        },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Caller is not an admin.' })
  async getReconciliation() {
    const result = await this.reconciliation.reconcile();
    return sendResponse(result, 'Reconciliation computed');
  }

  @Get('gas')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Master-wallet gas (POL) health (admin)',
    description:
      'Reports the master hot wallet’s native-POL reserve — the gas that pays ' +
      'for every sweep gas-drop and every withdrawal broadcast. Returns the ' +
      'current balance, the estimated POL per withdrawal (one USDC transfer at ' +
      'the live gas price), and how many withdrawals the balance still covers. ' +
      'When the balance is below MIN_POL_FLOOR it records a HIGH audit event and ' +
      'notifies every admin, so a draining hot wallet surfaces as a warning ' +
      'instead of a wave of 503s and failed sweeps. Read-only — never spends.',
  })
  @ApiOkResponse({
    description: 'Master-wallet gas health.',
    schema: {
      example: {
        status: true,
        message: 'Master wallet gas health',
        data: {
          masterAddress: '0xeF7FA7Ef55dfAA003C6991016194a21677271347',
          polBalance: '0.000355194975768184',
          perWithdrawalPol: '0.00195',
          withdrawalsRemaining: 0,
          floorPol: '0.2',
          status: 'empty',
          alerted: true,
          checkedAt: '2026-08-05T08:07:24.167Z',
        },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Caller is not an admin.' })
  async getGasHealth() {
    const result = await this.masterWalletGas.check();
    return sendResponse(result, 'Master wallet gas health');
  }
}
