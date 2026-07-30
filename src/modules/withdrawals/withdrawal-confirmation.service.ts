import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { env } from '../../config/env';
import { addMoney, normalizeMoney } from '../../common/utils/money';
import { ChainService } from '../chain/chain.service';
import { TransactionsService } from '../transactions/transactions.service';
import { WithdrawalsService } from './withdrawals.service';

/**
 * WithdrawalConfirmationService — Squad B (Wallet & Escrow). Week 3.
 * ──────────────────────────────────────────────────────────────────
 * Polls broadcast-but-unsettled withdrawals and finalises them:
 *   - enough confirmations + success  → mark SUCCESSFUL + notify
 *   - reverted or dropped on-chain     → mark FAILED + refund (amount + fee)
 *   - still pending                    → leave for the next tick
 *
 * The refund/settle logic itself lives in WithdrawalsService; this job just
 * drives it on a timer, mirroring the deposit watcher.
 */
@Injectable()
export class WithdrawalConfirmationService {
  private readonly logger = new Logger(WithdrawalConfirmationService.name);
  private running = false;

  constructor(
    private readonly chain: ChainService,
    private readonly transactions: TransactionsService,
    private readonly withdrawals: WithdrawalsService,
  ) {}

  @Interval('withdrawal-confirmation', env.chain.withdrawalPollMs)
  async poll(): Promise<void> {
    if (!this.chain.isConfigured() || this.running) {
      return;
    }
    this.running = true;
    try {
      await this.checkOnce();
    } catch (err) {
      this.logger.error(
        `Withdrawal confirmation poll failed: ${(err as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }

  /** One pass over all processing-and-broadcast withdrawals. */
  async checkOnce(): Promise<void> {
    const pending = await this.transactions.findProcessingWithdrawals();

    for (const tx of pending) {
      if (!tx.txHash) {
        continue;
      }

      const status = await this.chain.getReceiptStatus(tx.txHash);

      if (status === 'pending') {
        continue;
      }

      if (status === 'failed') {
        const refund = addMoney(
          normalizeMoney(tx.amount),
          normalizeMoney(tx.fee),
        );
        await this.withdrawals.failAndRefund(
          tx.id,
          tx.fromUserId ?? null,
          refund,
          'on-chain transaction failed',
        );
        continue;
      }

      // success — require the confirmation threshold before settling.
      const confirmations = await this.chain.getConfirmations(tx.txHash);
      if (confirmations >= env.chain.withdrawalConfirmations) {
        await this.withdrawals.markConfirmed(tx.id, tx.fromUserId ?? null);
      }
    }
  }
}
