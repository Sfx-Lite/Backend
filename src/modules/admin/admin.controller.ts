import { Controller, Get } from '@nestjs/common';
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
import { StatsOverviewResponseDto } from './dto/stats-overview-response.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly reconciliation: ReconciliationService,
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
}
