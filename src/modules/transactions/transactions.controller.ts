import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { KycVerifiedGuard } from '../../common/guards/kyc-verified.guard';
import { sendResponse } from '../../common/utils/response.util';
import { ListTransactionsQueryDto } from './dto/list-transactions.query.dto';
import { TransferDto } from './dto/transfer.dto';
import { counterpartyIdOf, toTransactionView } from './transaction-view';
import { TransactionsService } from './transactions.service';
import { TransfersService } from './transfers.service';
import { UsersService } from '../users/users.service';

/**
 * TransactionsController — Squad C.
 * ─────────────────────────────────
 * Money-movement + history endpoints backed by the ledger. Auth mirrors the
 * wallet routes — the caller is read from the JWT (`sub`); no id is trusted
 * from the body or params, so a user can only ever act on / read their own
 * transactions.
 */
/** A representative outgoing internal transfer, for Swagger examples. */
const EXAMPLE_TRANSFER = {
  id: '3f0c1e2a-9b7d-4c3e-8a1f-2b6d5e4c7a90',
  type: 'internal_transfer',
  status: 'successful',
  direction: 'debit',
  asset: 'USDC',
  amount: '10.500000',
  fee: '0.000000',
  note: 'Contribution for Alenenu Grammar school reunion in Qatar',
  counterpartyUserId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  counterpartyUsername: 'bob',
  externalAddress: null,
  txHash: null,
  createdAt: '2026-07-24T12:30:00.000Z',
};

/** A representative on-chain deposit, for Swagger examples. */
const EXAMPLE_DEPOSIT = {
  id: '7c9e6f81-2a3b-4d5e-9f0a-1b2c3d4e5f60',
  type: 'deposit',
  status: 'successful',
  direction: 'credit',
  asset: 'USDC',
  amount: '20.000000',
  fee: '0.000000',
  note: null,
  counterpartyUserId: null,
  counterpartyUsername: null,
  externalAddress: null,
  txHash: '0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
  createdAt: '2026-07-24T09:15:00.000Z',
};

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactions: TransactionsService,
    private readonly transfers: TransfersService,
    private readonly users: UsersService,
  ) {}

  // POST /api/v1/transactions/transfer
  @Post('transfer')
  @UseGuards(KycVerifiedGuard)
  @ApiOperation({
    summary: 'Send USDC to another SFx Lite user (internal, off-chain)',
    description:
      'Requires a verified KYC status — sending is locked until the user is ' +
      'verified. Deposits and receiving remain open pre-KYC.',
  })
  @ApiForbiddenResponse({
    description:
      'KYC not verified — the caller must complete identity verification to send.',
  })
  async transfer(@CurrentUser('sub') userId: string, @Body() dto: TransferDto) {
    if (!userId) {
      throw new UnauthorizedException();
    }

    const result = await this.transfers.transfer(userId, dto);

    return sendResponse(result, 'Transfer successful');
  }

  // GET /api/v1/transactions
  @Get()
  @ApiOperation({
    summary: "List the current user's transaction history (newest first)",
    description:
      'Returns transactions the caller sent or received, framed from their ' +
      'perspective (direction credit/debit, counterparty). Supports paging ' +
      '(limit/offset), a created_at date range (from/to), and free-text ' +
      'search across id, counterparty username, and asset.',
  })
  @ApiOkResponse({
    description: 'Paginated transaction history, newest first.',
    schema: {
      example: {
        status: true,
        message: 'Transaction history',
        data: {
          items: [EXAMPLE_TRANSFER, EXAMPLE_DEPOSIT],
          total: 2,
          limit: 20,
          offset: 0,
        },
      },
    },
  })
  async list(
    @CurrentUser('sub') userId: string,
    @Query() query: ListTransactionsQueryDto,
  ) {
    if (!userId) {
      throw new UnauthorizedException();
    }

    const page = await this.transactions.listForUser(userId, query);

    // Batch-resolve every counterparty's username in one query.
    const counterpartyIds = page.items
      .map((tx) => counterpartyIdOf(tx, userId))
      .filter((id): id is string => id !== null);
    const usernameById = await this.users.findUsernamesByIds(counterpartyIds);

    const items = page.items.map((tx) =>
      toTransactionView(tx, userId, usernameById),
    );

    return sendResponse(
      { items, total: page.total, limit: page.limit, offset: page.offset },
      'Transaction history',
    );
  }

  // GET /api/v1/transactions/:id
  @Get(':id')
  @ApiOperation({ summary: "Get one of the current user's transactions by id" })
  @ApiOkResponse({
    description: 'A single transaction the caller is a party to.',
    schema: {
      example: {
        status: true,
        message: 'Transaction detail',
        data: EXAMPLE_TRANSFER,
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'No transaction with that id belongs to the caller.',
    schema: {
      example: {
        statusCode: 404,
        message: 'Transaction not found',
        error: 'Not Found',
      },
    },
  })
  async detail(
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!userId) {
      throw new UnauthorizedException();
    }

    const tx = await this.transactions.findByIdForUser(id, userId);
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    const counterpartyId = counterpartyIdOf(tx, userId);
    const usernameById = await this.users.findUsernamesByIds(
      counterpartyId ? [counterpartyId] : [],
    );

    return sendResponse(
      toTransactionView(tx, userId, usernameById),
      'Transaction detail',
    );
  }
}
