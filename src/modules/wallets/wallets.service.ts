import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { HDNodeWallet, Mnemonic, getAddress } from 'ethers';

import { env } from '../../config/env';
import { Wallet } from './entities/wallet.entity';

/**
 * WalletsService — Squad B (Wallet & Escrow)
 * ──────────────────────────────────────────
 * The HD wallet foundation for the escrow model. Every user is assigned ONE
 * deterministic deposit address, derived from the master mnemonic at a unique
 * BIP-44 index (`m/44'/60'/0'/0/{index}`). Users never hold keys — only the
 * master mnemonic (a secret, held by the CTO + Backend Lead) can spend, so the
 * later sweep/withdraw jobs move funds, not the user.
 *
 * Design notes:
 *  - The private key is NEVER returned, logged, or persisted — only the public
 *    checksummed address leaves this service.
 *  - Derivation indices are allocated from a Postgres sequence
 *    (wallet_derivation_index_seq) so concurrent signups can't collide on an
 *    index. See the WalletDerivationSequence migration.
 *  - `createForUser` is idempotent: one wallet per user, safe to call again
 *    (e.g. to backfill a user who signed up before the mnemonic was configured).
 */
@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);
  private static readonly INDEX_SEQUENCE = 'wallet_derivation_index_seq';

  /** Parsed once, then reused — parsing validates the phrase up front. */
  private cachedMnemonic: Mnemonic | null = null;

  constructor(
    @InjectRepository(Wallet)
    private readonly wallets: Repository<Wallet>,
    private readonly dataSource: DataSource,
  ) {}

  private static derivationPath(index: number): string {
    return `m/44'/60'/0'/0/${index}`;
  }

  private getMnemonic(): Mnemonic {
    if (this.cachedMnemonic) {
      return this.cachedMnemonic;
    }

    const phrase = env.chain.masterMnemonic?.trim();
    if (!phrase) {
      // Configured later in Week 1 by the Backend Lead. Until then the wallet
      // service is intentionally unavailable rather than deriving from a bad key.
      throw new ServiceUnavailableException(
        'Wallet service unavailable: MASTER_WALLET_MNEMONIC is not configured',
      );
    }

    this.cachedMnemonic = Mnemonic.fromPhrase(phrase);
    return this.cachedMnemonic;
  }

  /**
   * Pure, deterministic derivation of the public deposit address at an index.
   * No DB, no side effects, no private-key exposure (checksummed address only).
   */
  deriveAddress(index: number): string {
    const node = HDNodeWallet.fromMnemonic(
      this.getMnemonic(),
      WalletsService.derivationPath(index),
    );
    return getAddress(node.address);
  }

  /**
   * Get-or-create the user's deposit wallet. Idempotent: returns the existing
   * wallet if one is already assigned, otherwise allocates the next derivation
   * index atomically, derives the address, and persists.
   *
   * Pass a `manager` to enlist in a caller's transaction (e.g. signup);
   * otherwise this opens its own.
   */
  async createForUser(userId: string, manager?: EntityManager): Promise<Wallet> {
    const assign = async (em: EntityManager): Promise<Wallet> => {
      const repo = em.getRepository(Wallet);

      const existing = await repo.findOne({ where: { userId } });
      if (existing) {
        return existing;
      }

      const rows = (await em.query(
        `SELECT nextval('${WalletsService.INDEX_SEQUENCE}')::int AS index`,
      )) as Array<{ index: number }>;
      const derivationIndex = Number(rows[0].index);

      const wallet = repo.create({
        userId,
        depositAddress: this.deriveAddress(derivationIndex),
        derivationIndex,
        asset: 'USDC',
      });
      await repo.save(wallet);

      // Address is public; the private key and mnemonic are never logged.
      this.logger.log(
        `Assigned deposit address to user ${userId} at derivation index ${derivationIndex}`,
      );
      return wallet;
    };

    return manager ? assign(manager) : this.dataSource.transaction(assign);
  }

  /** Read the user's assigned deposit wallet, or null if none yet. */
  findForUser(userId: string): Promise<Wallet | null> {
    return this.wallets.findOne({ where: { userId } });
  }
}
