import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { KycVerifiedGuard } from '../../common/guards/kyc-verified.guard';
import { sendResponse } from '../../common/utils/response.util';
import { WithdrawDto } from './dto/withdraw.dto';
import { WithdrawalsService } from './withdrawals.service';

/**
 * WithdrawalsController — Squad B. Money OUT (on-chain USDC from the master
 * wallet). Gated by KYC (verified only) and, inside the service, the caller's
 * transaction PIN. The caller is read from the JWT — never trusted from the body.
 */
@ApiTags('withdrawals')
@ApiBearerAuth()
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  // POST /api/v1/withdrawals
  @Post()
  @UseGuards(KycVerifiedGuard)
  @ApiOperation({
    summary: 'Withdraw USDC to an external wallet (on-chain)',
    description:
      'Requires verified KYC and a valid transaction PIN. The fee is computed ' +
      'by the shared fee engine (as a local USD transfer). The user is debited ' +
      'amount + fee and the withdrawal is created as `processing`; the USDC is ' +
      'then broadcast from the master wallet. A background job confirms it ' +
      '(→ `successful`) or, on failure, refunds the balance (→ `failed`). ' +
      'A broadcast that never leaves the node refunds immediately.',
  })
  @ApiBody({ type: WithdrawDto })
  @ApiOkResponse({
    description: 'Withdrawal accepted and broadcast; now processing.',
    schema: {
      example: {
        status: true,
        message: 'Withdrawal initiated',
        data: {
          transactionId: '9f0c1e2a-9b7d-4c3e-8a1f-2b6d5e4c7a90',
          status: 'processing',
          amount: '25.500000',
          fee: '0.500000',
          total: '26.000000',
          externalAddress: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
          txHash:
            '0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
          balanceAfter: '74.000000',
        },
      },
    },
  })
  @ApiForbiddenResponse({
    description:
      'KYC not verified, PIN not set, PIN incorrect, or PIN temporarily locked.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Insufficient funds to cover amount + fee.',
  })
  async withdraw(@CurrentUser('sub') userId: string, @Body() dto: WithdrawDto) {
    if (!userId) {
      throw new UnauthorizedException();
    }
    const result = await this.withdrawals.withdraw(userId, dto);
    return sendResponse(result, 'Withdrawal initiated');
  }
}
