import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import {
  addMoney,
  isPositiveMoney,
  normalizeMoney,
} from '../../common/utils/money';
import { AuditService } from '../audit/audit.service';
import { AuditCategory } from '../audit/enums/audit-category.enum';
import { AuditLevel } from '../audit/enums/audit-level.enum';
import { AuthService } from '../auth/auth.service';
import { ChainService } from '../chain/chain.service';
import { FeeService } from '../fees/fee.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import { TransactionsService } from '../transactions/transactions.service';
import { WalletsService } from '../wallets/wallets.service';
import { WithdrawDto } from './dto/withdraw.dto';

const ASSET = 'USDC';

/** What the caller/FE gets back after a withdrawal is accepted. */
export interface WithdrawalResult {
  transactionId: string;
  status: TransactionStatus;
  amount: string;
  fee: string;
  total: string;
  externalAddress: string;
  txHash: string | null;
  balanceAfter: string;
}

/**
 * WithdrawalsService — Squad B (Wallet & Escrow). Week 3.
 * ────────────────────────────────────────────────────────
 * Money OUT: the mirror of an internal transfer, but it leaves the platform
 * on-chain. The invariant that keeps custody safe is DEBIT BEFORE BROADCAST —
 * we reserve the user's funds on the ledger first, and only then send USDC from
 * the master wallet.
 *
 * Fee model (per team decision): the withdrawal fee comes from the same engine
 * as /fees/calculate — FeeService, treated as a local USD→USD transfer. The
 * user is debited amount + fee; only `amount` is sent on-chain; `fee` is
 * retained on the transaction row (SUM(fee) over successful withdrawals is
 * admin revenue). Internal SFx→SFx transfers remain free.
 */
@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly auth: AuthService,
    private readonly fees: FeeService,
    private readonly transactions: TransactionsService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
    private readonly chain: ChainService,
    private readonly wallets: WalletsService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Initiate a withdrawal. KYC is enforced by the guard on the route; here we
   * verify the PIN, compute the fee, atomically debit + record, then broadcast.
   * A broadcast failure immediately refunds and rethrows.
   */
  async withdraw(userId: string, dto: WithdrawDto): Promise<WithdrawalResult> {
    if (!isPositiveMoney(dto.amount)) {
      throw new BadRequestException(
        'Withdrawal amount must be greater than zero',
      );
    }

    // PIN check (throws on wrong/locked PIN — with attempt lockout).
    await this.auth.verifyPin(userId, dto.pin);

    const amount = normalizeMoney(dto.amount);

    // Fee from the shared engine (USDC treated as USD → "local" transfer).
    const feeBreakdown = await this.fees.calculateFee(
      Number(amount),
      'USD',
      'USD',
    );
    const fee = normalizeMoney(feeBreakdown.fee.toFixed(6));
    const total = addMoney(amount, fee);

    // Reserve funds first: debit amount + fee and record the withdrawal, all in
    // ONE DB transaction. Throws InsufficientFundsException (422) if short,
    // rolling the whole thing back before any chain call.
    const posted = await this.dataSource.transaction(async (em) => {
      const transaction = await this.transactions.createWithdrawal(
        {
          userId,
          amount,
          fee,
          externalAddress: dto.externalAddress,
          note: dto.note ?? null,
        },
        em,
      );

      const debit = await this.ledger.debit(
        transaction.id,
        userId,
        total,
        ASSET,
        em,
      );

      await this.notifications.create(
        {
          userId,
          type: 'withdrawal',
          title: 'Withdrawal initiated',
          body: `Your withdrawal of ${amount} ${ASSET} (fee ${fee}) is processing.`,
        },
        em,
      );

      return {
        transactionId: transaction.id,
        balanceAfter: debit.balanceAfter,
      };
    });

    // Only NOW touch the chain — funds are already reserved.
    let txHash: string | null = null;
    try {
      const provider = this.chain.getProvider();
      const master = this.wallets.masterSigner(provider);
      txHash = await this.chain.sendUsdc(master, dto.externalAddress, amount);
      await this.transactions.attachTxHash(posted.transactionId, txHash);

      await this.audit.saveLog({
        action: 'withdrawal.broadcast',
        category: AuditCategory.TRANSACTION,
        level: AuditLevel.MEDIUM,
        actorId: userId,
        entity: 'transaction',
        entityId: posted.transactionId,
        metadata: { amount, fee, externalAddress: dto.externalAddress, txHash },
      });
    } catch (err) {
      // Couldn't even broadcast — refund immediately so the user isn't left short.
      this.logger.error(
        `Withdrawal ${posted.transactionId} broadcast failed: ${(err as Error).message}`,
      );
      await this.failAndRefund(
        posted.transactionId,
        userId,
        total,
        'broadcast failed',
      );
      throw new ServiceUnavailableException(
        'Withdrawal could not be broadcast. Your balance has been refunded.',
      );
    }

    return {
      transactionId: posted.transactionId,
      status: TransactionStatus.PROCESSING,
      amount,
      fee,
      total,
      externalAddress: dto.externalAddress,
      txHash,
      balanceAfter: posted.balanceAfter,
    };
  }

  /**
   * Mark a withdrawal successful (called by the confirmation job once the
   * on-chain tx has enough confirmations). Notifies the user.
   */
  async markConfirmed(
    transactionId: string,
    userId: string | null,
  ): Promise<void> {
    await this.transactions.markStatus(
      transactionId,
      TransactionStatus.SUCCESSFUL,
    );

    if (userId) {
      await this.notifications.create({
        userId,
        type: 'withdrawal',
        title: 'Withdrawal successful',
        body: 'Your withdrawal has been confirmed on-chain.',
      });
    }

    await this.audit.saveLog({
      action: 'withdrawal.succeeded',
      category: AuditCategory.TRANSACTION,
      level: AuditLevel.MEDIUM,
      actorId: userId,
      entity: 'transaction',
      entityId: transactionId,
    });
  }

  /**
   * Mark a withdrawal FAILED and refund the reserved funds (amount + fee) as a
   * compensating credit under the same transaction id. This is the one place a
   * reversing ledger entry is expected. Idempotency: only refunds a row that is
   * still PROCESSING (the confirmation job and the broadcast-failure path can't
   * both refund the same withdrawal).
   */
  async failAndRefund(
    transactionId: string,
    userId: string | null,
    refundAmount: string,
    reason: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const marked = await this.transactions.markStatusIfProcessing(
        transactionId,
        TransactionStatus.FAILED,
        em,
      );
      if (!marked) {
        return; // already settled — don't double-refund
      }

      if (userId) {
        await this.ledger.credit(
          transactionId,
          userId,
          refundAmount,
          ASSET,
          em,
        );

        await this.notifications.create(
          {
            userId,
            type: 'withdrawal',
            title: 'Withdrawal failed',
            body: `Your withdrawal could not be completed (${reason}). ${refundAmount} ${ASSET} has been refunded.`,
          },
          em,
        );
      }
    });

    await this.audit.saveLog({
      action: 'withdrawal.failed',
      category: AuditCategory.TRANSACTION,
      level: AuditLevel.HIGH,
      actorId: userId,
      entity: 'transaction',
      entityId: transactionId,
      metadata: { reason, refundAmount },
    });
  }
}
