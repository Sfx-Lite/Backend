import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuditService } from '../audit/audit.service';
import { AuditCategory } from '../audit/enums/audit-category.enum';
import { AuditLevel } from '../audit/enums/audit-level.enum';
import { ChainService } from '../chain/chain.service';
import { LedgerService } from '../ledger/ledger.service';
import {
  ZERO_MONEY,
  addMoney,
  compareMoney,
  subtractMoney,
} from '../../common/utils/money';
import { Wallet } from './entities/wallet.entity';
import { WalletsService } from './wallets.service';

/** The outcome of one reconciliation check. */
export interface ReconciliationResult {
  asset: string;
  /** Σ of every user's current ledger balance — what we OWE users. */
  liabilities: string;
  /** USDC in the master wallet on-chain. */
  masterBalance: string;
  /** USDC still sitting in deposit addresses (not yet swept). */
  unsweptBalance: string;
  /** masterBalance + unsweptBalance — the USDC we actually hold. */
  custody: string;
  /** custody − liabilities. ≥ 0 is healthy (a surplus); < 0 is a shortfall. */
  difference: string;
  /** True when liabilities ≤ custody (the invariant holds). */
  healthy: boolean;
  checkedAt: string;
}

/**
 * ReconciliationService — Squad B (Wallet & Escrow). Week 3.
 * ───────────────────────────────────────────────────────────
 * The daily integrity check from §03: prove the books match the chain.
 *
 *   Σ user ledger balances  ≤  master-wallet USDC  +  unswept deposit USDC
 *
 * The left side is what we owe users (from the DB ledger). The right side is
 * the USDC we actually custody on-chain. If liabilities ever exceed custody,
 * something is wrong (a bad credit, a missing sweep, a drained wallet) and we
 * raise a HIGH-severity audit event for the admin dashboard.
 *
 * This service is READ-ONLY: it never moves money, it only measures.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private static readonly ASSET = 'USDC';

  constructor(
    @InjectRepository(Wallet)
    private readonly wallets: Repository<Wallet>,
    private readonly ledger: LedgerService,
    private readonly chain: ChainService,
    private readonly walletsService: WalletsService,
    private readonly audit: AuditService,
  ) {}

  /** Run once a day at midnight. Logs + audits any discrepancy. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'daily-reconciliation' })
  async dailyCheck(): Promise<void> {
    if (!this.chain.isConfigured()) {
      this.logger.warn('Reconciliation skipped: chain env not configured');
      return;
    }
    try {
      await this.reconcile();
    } catch (err) {
      this.logger.error(`Reconciliation failed: ${(err as Error).message}`);
    }
  }

  /**
   * Compute the invariant now and return the snapshot. Also backs
   * GET /admin/reconciliation so the admin can check on demand. Raises a
   * high-level audit log if the invariant is broken.
   */
  async reconcile(): Promise<ReconciliationResult> {
    const asset = ReconciliationService.ASSET;

    const liabilities = await this.ledger.sumOfUserBalances(asset);
    const masterBalance = await this.chain.usdcBalanceOf(
      this.walletsService.masterAddress(),
    );

    // Sum the on-chain USDC still sitting in user deposit addresses.
    const wallets = await this.wallets.find();
    let unsweptBalance = ZERO_MONEY;
    for (const wallet of wallets) {
      const balance = await this.chain.usdcBalanceOf(wallet.depositAddress);
      unsweptBalance = addMoney(unsweptBalance, balance);
    }

    const custody = addMoney(masterBalance, unsweptBalance);
    const difference = subtractMoney(custody, liabilities);
    const healthy = compareMoney(liabilities, custody) <= 0;

    const result: ReconciliationResult = {
      asset,
      liabilities,
      masterBalance,
      unsweptBalance,
      custody,
      difference,
      healthy,
      checkedAt: new Date().toISOString(),
    };

    if (!healthy) {
      this.logger.error(
        `RECONCILIATION DISCREPANCY: liabilities ${liabilities} > custody ${custody} (short ${difference})`,
      );
      await this.audit.saveLog({
        action: 'reconciliation.discrepancy',
        category: AuditCategory.WALLET,
        level: AuditLevel.HIGH,
        entity: 'reconciliation',
        metadata: { ...result },
      });
    } else {
      this.logger.log(
        `Reconciliation OK: liabilities ${liabilities} ≤ custody ${custody}`,
      );
    }

    return result;
  }
}
