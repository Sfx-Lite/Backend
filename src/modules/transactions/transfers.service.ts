import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { isPositiveMoney, normalizeMoney } from '../../common/utils/money';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { TransactionsService } from './transactions.service';

/** What the caller (and FE) gets back after a successful transfer. */
export interface TransferResult {
  transactionId: string;
  amount: string;
  asset: string;
  /** Recipient's username. */
  recipient: string;
  /** Sender's balance immediately after the debit. */
  balanceAfter: string;
}

export interface TransferInput {
  recipientUsername: string;
  amount: string;
  note?: string;
}

/**
 * TransfersService — Squad C (Payments & Ledger).
 * ────────────────────────────────────────────────
 * Internal, user-to-user USDC transfers. Unlike a deposit or withdrawal, this
 * NEVER touches Polygon — it's a pure in-app ledger movement: debit the sender,
 * credit the recipient, in ONE database transaction so the transaction record,
 * both ledger legs, and both notifications either all commit or all roll back.
 *
 * The money math, balance check (no overdraft) and per-account locking are the
 * ledger's job (LedgerService.transfer). This service just resolves the
 * recipient, guards the request, and orchestrates the atomic write.
 */
@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);
  private static readonly ASSET = 'USDC';

  constructor(
    private readonly users: UsersService,
    private readonly transactions: TransactionsService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Send `amount` USDC from `senderId` to the user named `recipientUsername`.
   * Throws:
   *  - 400 if the amount isn't positive or the recipient is the sender,
   *  - 404 if no user has that username,
   *  - 422 (InsufficientFundsException, from the ledger) if the sender can't
   *    cover it — which rolls the whole posting back.
   */
  async transfer(
    senderId: string,
    input: TransferInput,
  ): Promise<TransferResult> {
    const asset = TransfersService.ASSET;

    if (!isPositiveMoney(input.amount)) {
      throw new BadRequestException(
        'Transfer amount must be greater than zero',
      );
    }
    const amount = normalizeMoney(input.amount);

    const recipient = await this.users.findByUsername(input.recipientUsername);
    if (!recipient) {
      throw new NotFoundException(
        `No user found with username "${input.recipientUsername}"`,
      );
    }
    if (recipient.id === senderId) {
      throw new BadRequestException('You cannot transfer to yourself');
    }

    const sender = await this.users.findById(senderId);
    const senderName = sender?.username ?? 'someone';

    const posted = await this.dataSource.transaction(async (em) => {
      const transaction = await this.transactions.createInternalTransfer(
        {
          fromUserId: senderId,
          toUserId: recipient.id,
          amount,
          asset,
          note: input.note ?? null,
        },
        em,
      );

      // Debit sender + credit recipient atomically. Balance-checked: throws
      // InsufficientFundsException (422) if the sender is short, rolling back
      // the transaction row and both notifications with it.
      const [debit] = await this.ledger.transfer(
        transaction.id,
        senderId,
        recipient.id,
        amount,
        asset,
        em,
      );

      await this.notifications.create(
        {
          userId: senderId,
          type: 'transfer',
          title: 'Transfer sent',
          body: `You sent ${amount} ${asset} to @${recipient.username}.`,
        },
        em,
      );
      await this.notifications.create(
        {
          userId: recipient.id,
          type: 'transfer',
          title: 'Transfer received',
          body: `You received ${amount} ${asset} from @${senderName}.`,
        },
        em,
      );

      return {
        transactionId: transaction.id,
        balanceAfter: debit.balanceAfter,
      };
    });

    this.logger.log(
      `Internal transfer ${posted.transactionId}: ${senderId} → ${recipient.id} (${amount} ${asset})`,
    );

    return {
      transactionId: posted.transactionId,
      amount,
      asset,
      recipient: recipient.username,
      balanceAfter: posted.balanceAfter,
    };
  }
}
