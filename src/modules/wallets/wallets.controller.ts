import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

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
}
