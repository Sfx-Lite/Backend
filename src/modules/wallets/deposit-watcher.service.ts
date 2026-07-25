import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { getAddress } from 'ethers';

import { env } from '../../config/env';
import { LedgerService } from '../ledger/ledger.service';
import { TransactionsService } from '../transactions/transactions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChainService, UsdcTransfer } from '../chain/chain.service';
import { Wallet } from './entities/wallet.entity';

/** Result of handling one on-chain transfer, surfaced for tests/logging. */
export interface DepositResult {
  credited: boolean;
  transactionId?: string;
  balanceAfter?: string;
}

/** How often the watcher polls Amoy. ~15s per the program doc (§03). */
const POLL_INTERVAL_MS = 15_000;
/** Cap blocks scanned per poll so a big backlog can't blow the RPC free tier. */
const MAX_RANGE_PER_POLL = 2_000;

/**
 * DepositWatcherService — Squad B (Wallet & Escrow). M2 deliverable.
 * ──────────────────────────────────────────────────────────────────
 * Polls Polygon Amoy for USDC Transfer events into user deposit addresses.
 * Once an event has N confirmations it records a deposit transaction, credits
 * the user's ledger, and notifies them — all in ONE database transaction so the
 * three either commit together or not at all.
 *
 * Idempotency: re-scanning overlapping ranges never double-credits, because
 * handleDeposit checks for an existing deposit on (txHash, userId) first. The
 * money math and balance locking are the ledger's job; the sweep of these
 * funds into the master wallet is a separate Week-3 job.
 *
 * Dormant until ChainService is configured (Week 1), so the app boots fine
 * before the RPC URL / USDC address are set.
 */
@Injectable()
export class DepositWatcherService {
  private readonly logger = new Logger(DepositWatcherService.name);
  private running = false;
  /** Next block to scan from; undefined until the first poll seeds it. */
  private nextFromBlock: number | undefined;
  private warnedUnconfigured = false;

  constructor(
    @InjectRepository(Wallet)
    private readonly wallets: Repository<Wallet>,
    private readonly chain: ChainService,
    private readonly transactions: TransactionsService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  @Interval('deposit-watcher', POLL_INTERVAL_MS)
  async poll(): Promise<void> {
    if (!this.chain.isConfigured()) {
      if (!this.warnedUnconfigured) {
        this.logger.warn(
          'Deposit watcher idle: chain env (RPC URL / USDC address) not configured',
        );
        this.warnedUnconfigured = true;
      }
      return;
    }

    // Single-flight: never let a slow poll overlap the next tick.
    if (this.running) {
      return;
    }
    this.running = true;

    try {
      await this.scanOnce();
    } catch (err) {
      this.logger.error(
        `Deposit watcher poll failed: ${(err as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * One scan pass: work out the confirmed block window, pull USDC transfers to
   * our addresses, and credit any new ones. Exposed (not private) so it can be
   * driven directly in tests without the timer.
   */
  async scanOnce(): Promise<void> {
    const confirmations = env.chain.depositConfirmations;
    const head = await this.chain.getBlockNumber();
    const safeHead = head - confirmations;
    if (safeHead < 0) {
      return;
    }

    const fromBlock =
      this.nextFromBlock ?? Math.max(0, safeHead - env.chain.coldStartLookback);
    if (fromBlock > safeHead) {
      return; // nothing new has reached the confirmation threshold
    }

    const toBlock = Math.min(safeHead, fromBlock + MAX_RANGE_PER_POLL);

    const addressToUser = await this.loadDepositAddressMap();
    if (addressToUser.size > 0) {
      const transfers = await this.chain.queryUsdcTransfersTo(
        [...addressToUser.keys()],
        fromBlock,
        toBlock,
      );

      for (const transfer of transfers) {
        const userId = addressToUser.get(transfer.to);
        if (!userId) {
          continue;
        }
        await this.handleDeposit(userId, transfer);
      }
    }

    this.nextFromBlock = toBlock + 1;
  }

  /**
   * Atomically record + credit + notify a single confirmed deposit. Idempotent:
   * if this deposit was already processed, it returns without side effects.
   */
  async handleDeposit(
    userId: string,
    transfer: Pick<UsdcTransfer, 'txHash' | 'amount'> & { asset?: string },
  ): Promise<DepositResult> {
    const asset = transfer.asset ?? 'USDC';

    return this.dataSource.transaction(async (em) => {
      const existing = await this.transactions.findDepositByHashForUser(
        transfer.txHash,
        userId,
        em,
      );
      if (existing) {
        return { credited: false };
      }

      const transaction = await this.transactions.createDeposit(
        { userId, amount: transfer.amount, txHash: transfer.txHash, asset },
        em,
      );

      const entry = await this.ledger.credit(
        transaction.id,
        userId,
        transfer.amount,
        asset,
        em,
      );

      await this.notifications.create(
        {
          userId,
          type: 'deposit',
          title: 'Deposit received',
          body: `Your deposit of ${transfer.amount} ${asset} has been credited to your balance.`,
        },
        em,
      );

      this.logger.log(
        `Credited deposit ${transfer.txHash} → user ${userId} (+${transfer.amount} ${asset})`,
      );

      return {
        credited: true,
        transactionId: transaction.id,
        balanceAfter: entry.balanceAfter,
      };
    });
  }

  /** Map of checksummed deposit address → userId for every user wallet. */
  private async loadDepositAddressMap(): Promise<Map<string, string>> {
    const wallets = await this.wallets.find({
      select: ['userId', 'depositAddress'],
    });

    const map = new Map<string, string>();
    for (const wallet of wallets) {
      map.set(getAddress(wallet.depositAddress), wallet.userId);
    }
    return map;
  }
}
