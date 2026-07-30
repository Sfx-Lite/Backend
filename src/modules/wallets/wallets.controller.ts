import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { sendResponse } from '../../common/utils/response.util';
import { WalletsService } from './wallets.service';

/**
 * WalletsController —
 * ───────────────────────────
 * Thin HTTP surface for a user's deposit address. Business logic (derivation,
 * index allocation) lives entirely in WalletsService.
 *
 * Auth: reads the caller from the JWT payload (`sub`), populated once Squad A's
 * global JWT guard is switched on. Until then `sub` is undefined and the route
 * refuses the request rather than leaking another user's address.
 */
@ApiTags('wallets')
@ApiBearerAuth()
@Controller('wallets')
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  // GET /api/v1/wallets/address
  @Get('address')
  @ApiOperation({
    summary: "Get the current user's USDC deposit address (Polygon Amoy)",
  })
  @ApiOkResponse({
    description: 'The caller’s USDC deposit address.',
    schema: {
      example: {
        status: true,
        message: 'Deposit address',
        data: {
          asset: 'USDC',
          network: 'polygon-amoy',
          depositAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        },
      },
    },
  })
  async address(@CurrentUser('sub') userId: string) {
    if (!userId) {
      throw new UnauthorizedException();
    }

    // Get-or-create so an address always exists for a verified caller, even if
    // they registered before the master mnemonic was configured.
    const wallet = await this.wallets.createForUser(userId);

    return sendResponse(
      {
        asset: wallet.asset,
        network: 'polygon-amoy',
        depositAddress: wallet.depositAddress,
      },
      'Deposit address',
    );
  }

  // GET /api/v1/wallets/balance
  @Get('balance')
  @ApiOperation({
    summary: "Get the current user's in-app USDC balance (from the ledger)",
  })
  @ApiOkResponse({
    description: 'The caller’s spendable in-app balance (decimal string).',
    schema: {
      example: {
        status: true,
        message: 'Wallet balance',
        data: {
          asset: 'USDC',
          network: 'polygon-amoy',
          balance: '20.500000',
        },
      },
    },
  })
  async balance(@CurrentUser('sub') userId: string) {
    if (!userId) {
      throw new UnauthorizedException();
    }

    const balance = await this.wallets.balanceForUser(userId);

    return sendResponse(balance, 'Wallet balance');
  }
}
