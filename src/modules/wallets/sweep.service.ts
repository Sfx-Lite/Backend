import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HDNodeWallet, JsonRpcProvider, parseEther } from 'ethers';

import { env } from '../../config/env';
import { AuditService } from '../audit/audit.service';
import { AuditCategory } from '../audit/enums/audit-category.enum';
import { AuditLevel } from '../audit/enums/audit-level.enum';
import { ChainService } from '../chain/chain.service';
import { TransactionsService } from '../transactions/transactions.service';
import { addMoney, compareMoney } from '../../common/utils/money';
import { Wallet } from './entities/wallet.entity';
import { WalletsService } from './wallets.service';

/** Outcome of sweeping one address, surfaced for tests/logging. */
export interface SweepResult {
  swept: boolean;
  amount?: string;
  txHash?: string;
}

/**
 * SweepService — Squad B (Wallet & Escrow). Week 3.
 * ──────────────────────────────────────────────────
 * Consolidates deposited USDC out of each user's derived deposit address into
 * the one master wallet. Runs on a timer, like the deposit watcher.
 *
 * For every deposit address holding ≥ SWEEP_MIN_USDC:
 *   1. Gas-drop a little POL from the master wallet (a derived address starts
 *      with no gas and can't move its own tokens).
 *   2. Sign a USDC transfer FROM that address TO the master wallet.
 *   3. Record a `sweep` transaction and bump the wallet's swept_balance.
 *
 * THE CRUCIAL RULE: a sweep NEVER touches the ledger. The user was already
 * credited when the deposit confirmed; this is pure custody plumbing. Balances
 * (what we owe users) are unchanged; only where the USDC physically sits moves.
 *
 * Idempotency/resumability: sweeping reads the LIVE on-chain balance and only
 * acts when it's above the dust threshold. Because a successful sweep empties
 * the address, a re-run simply sees ~0 and skips it — a crash after sending
 * can't double-send on the next pass. A single-flight guard stops overlapping
 * ticks within the process. (A future hardening is a persisted `sweeping` state
 * column for multi-instance safety; single-instance on Render doesn't need it.)
 */
@Injectable()
export class SweepService {
  private readonly logger = new Logger(SweepService.name);
  private running = false;
  private warnedUnconfigured = false;

  constructor(
    @InjectRepository(Wallet)
    private readonly wallets: Repository<Wallet>,
    private readonly chain: ChainService,
    private readonly walletsService: WalletsService,
    private readonly transactions: TransactionsService,
    private readonly audit: AuditService,
  ) {}

  @Interval('escrow-sweep', env.chain.sweepIntervalMs)
  async poll(): Promise<void> {
    if (!this.chain.isConfigured()) {
      if (!this.warnedUnconfigured) {
        this.logger.warn('Sweep job idle: chain env not configured');
        this.warnedUnconfigured = true;
      }
      return;
    }

    if (this.running) {
      return;
    }
    this.running = true;

    try {
      await this.sweepOnce();
    } catch (err) {
      this.logger.error(`Sweep poll failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * One pass: check every deposit address's on-chain USDC and sweep any that
   * are above the dust threshold. Public so tests can drive it without the timer.
   */
  async sweepOnce(): Promise<void> {
    const wallets = await this.wallets.find();
    if (wallets.length === 0) {
      return;
    }

    const provider = this.chain.getProvider();
    const master = this.walletsService.masterSigner(provider);
    const masterAddress = this.walletsService.masterAddress();

    for (const wallet of wallets) {
      // Never sweep the master onto itself.
      if (wallet.depositAddress === masterAddress) {
        continue;
      }

      const balance = await this.chain.usdcBalanceOf(wallet.depositAddress);
      if (compareMoney(balance, env.chain.sweepMinUsdc) < 0) {
        continue; // dust or empty — nothing worth the gas
      }

      try {
        await this.sweepAddress(wallet, balance, master, provider);
      } catch (err) {
        // One bad address must not stall the rest — log and continue.
        this.logger.error(
          `Sweep of ${wallet.depositAddress} failed: ${(err as Error).message}`,
        );
      }
    }
  }

  /** Gas-drop (if needed) then move all USDC from one deposit address to master. */
  async sweepAddress(
    wallet: Wallet,
    amount: string,
    master: HDNodeWallet,
    provider: JsonRpcProvider,
  ): Promise<SweepResult> {
    // 1. Ensure the address has gas. Only drop if it's below the drop amount,
    //    so we don't keep topping up an address that already has POL.
    const nativeBalance = await this.chain.getNativeBalance(
      wallet.depositAddress,
    );
    if (nativeBalance < parseEther(env.chain.gasDropPol)) {
      await this.chain.sendNative(
        master,
        wallet.depositAddress,
        env.chain.gasDropPol,
      );
    }

    // 2. Sign and broadcast the USDC transfer FROM the deposit address.
    const signer = this.walletsService.signerForIndex(
      wallet.derivationIndex,
      provider,
    );
    const txHash = await this.chain.sendUsdc(
      signer,
      this.walletsService.masterAddress(),
      amount,
    );

    // 3. Record the sweep (NOT a ledger movement) and track swept_balance.
    await this.transactions.createSweep({
      amount,
      txHash,
      note: `Swept ${amount} USDC from ${wallet.depositAddress}`,
    });

    wallet.sweptBalance = addMoney(wallet.sweptBalance, amount);
    await this.wallets.save(wallet);

    await this.audit.saveLog({
      action: 'wallet.swept',
      category: AuditCategory.WALLET,
      level: AuditLevel.NORMAL,
      entity: 'wallet',
      entityId: wallet.id,
      metadata: {
        userId: wallet.userId,
        address: wallet.depositAddress,
        amount,
        txHash,
      },
    });

    this.logger.log(
      `Swept ${amount} USDC from ${wallet.depositAddress} → master (${txHash})`,
    );

    return { swept: true, amount, txHash };
  }
}
