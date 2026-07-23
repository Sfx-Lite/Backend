import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import {
  ZERO_MONEY,
  addMoney,
  compareMoney,
  isPositiveMoney,
  normalizeMoney,
  subtractMoney,
} from '../../common/utils/money';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { LedgerDirection } from './enums/ledger-direction.enum';
import { InsufficientFundsException } from './exceptions/insufficient-funds.exception';

const DEFAULT_ASSET = 'USDC';

/** One leg of a ledger posting — a single debit or credit to one user. */
export interface LedgerLeg {
  userId: string;
  direction: LedgerDirection;
  /** Positive decimal string, e.g. "10.5". Sign is carried by `direction`. */
  amount: string;
  asset?: string;
}

export interface PostOptions {
  /**
   * Allow a debit to push a balance below zero. Off by default — every debit is
   * balance-checked. The withdrawal refund path may set this if it ever needs
   * to, but normal flows should not.
   */
  allowNegative?: boolean;
}

/**
 * LedgerService 
 * ──────────────────────────────────────────────────────────────────
 * The append-only, double-entry ledger every money flow is built on:
 *   • deposit watcher credits a user when USDC confirms on-chain
 *   • internal transfer debits sender + credits recipient atomically
 *   • withdrawal debits a user, then broadcasts from the master wallet
 *
 * Guarantees:
 *   1. Append-only. We only ever INSERT `ledger_entries`; a correction is a new
 *      compensating entry, never an UPDATE/DELETE.
 *   2. Balance integrity under concurrency. Every posting takes a per-user
 *      Postgres transaction-scoped advisory lock, so two concurrent postings to
 *      the same user serialise and can never compute a stale `balance_after`.
 *      Locks are acquired in a deterministic order, so multi-user postings
 *      (transfers) can't deadlock.
 *   3. Money is exact. Amounts are `numeric(18,6)` strings handled via BigInt
 *      micro-units (see common/utils/money) — never a float.
 *
 * NOTE on idempotency: de-duplicating a deposit by tx hash is the caller's job
 * (the deposit watcher checks/creates the `transactions` row first, then posts
 * here). The ledger trusts that each call is a distinct, intended movement.
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectRepository(LedgerEntry)
    private readonly entries: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Current balance for a user in one asset: the `balance_after` of their most
   * recent entry, or zero if they have none. Pass a `manager` to read inside an
   * open transaction (e.g. right after posting).
   */
  async getBalance(
    userId: string,
    asset: string = DEFAULT_ASSET,
    manager?: EntityManager,
  ): Promise<string> {
    const repo = manager ? manager.getRepository(LedgerEntry) : this.entries;

    const latest = await repo.findOne({
      where: { userId, asset },
      order: { createdAt: 'DESC', id: 'DESC' },
    });

    return latest ? normalizeMoney(latest.balanceAfter) : ZERO_MONEY;
  }

  /**
   * Post one or more legs as a single atomic double-entry movement. All legs
   * share the same `transactionId` and either all commit or none do.
   *
   * Pass a `manager` to enlist in the caller's transaction (the usual case —
   * the transaction row and the ledger legs commit together); otherwise this
   * opens its own transaction.
   */
  async post(
    transactionId: string,
    legs: LedgerLeg[],
    manager?: EntityManager,
    options: PostOptions = {},
  ): Promise<LedgerEntry[]> {
    if (legs.length === 0) {
      throw new BadRequestException('A ledger posting needs at least one leg');
    }

    const run = (em: EntityManager) =>
      this.execute(em, transactionId, legs, options);

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  /** Convenience: credit a single user (e.g. a confirmed deposit). */
  async credit(
    transactionId: string,
    userId: string,
    amount: string,
    asset: string = DEFAULT_ASSET,
    manager?: EntityManager,
  ): Promise<LedgerEntry> {
    const [entry] = await this.post(
      transactionId,
      [{ userId, direction: LedgerDirection.CREDIT, amount, asset }],
      manager,
    );
    return entry;
  }

  /** Convenience: debit a single user (balance-checked). */
  async debit(
    transactionId: string,
    userId: string,
    amount: string,
    asset: string = DEFAULT_ASSET,
    manager?: EntityManager,
  ): Promise<LedgerEntry> {
    const [entry] = await this.post(
      transactionId,
      [{ userId, direction: LedgerDirection.DEBIT, amount, asset }],
      manager,
    );
    return entry;
  }

  /**
   * Atomic internal transfer: debit sender + credit recipient in one posting.
   * Returns [debitEntry, creditEntry]. Self-transfers are rejected.
   */
  async transfer(
    transactionId: string,
    fromUserId: string,
    toUserId: string,
    amount: string,
    asset: string = DEFAULT_ASSET,
    manager?: EntityManager,
  ): Promise<[LedgerEntry, LedgerEntry]> {
    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot transfer to the same account');
    }

    const entries = await this.post(
      transactionId,
      [
        { userId: fromUserId, direction: LedgerDirection.DEBIT, amount, asset },
        { userId: toUserId, direction: LedgerDirection.CREDIT, amount, asset },
      ],
      manager,
    );

    return [entries[0], entries[1]];
  }

  // ───────────────────────────── internals ─────────────────────────────

  /**
   * Does the real work inside a transaction: lock every affected account, then
   * append each leg computing `balance_after` off the locked, up-to-date
   * balance. Legs are written in the order given, so a transfer's debit lands
   * before its credit.
   */
  private async execute(
    em: EntityManager,
    transactionId: string,
    legs: LedgerLeg[],
    options: PostOptions,
  ): Promise<LedgerEntry[]> {
    const normalizedLegs = legs.map((leg) => this.validateLeg(leg));

    await this.lockAccounts(em, normalizedLegs);

    // Running balances per account, seeded from the locked DB state and updated
    // as we apply each leg (so multiple legs on one account stay consistent).
    const balances = new Map<string, string>();

    const repo = em.getRepository(LedgerEntry);
    const created: LedgerEntry[] = [];

    for (const leg of normalizedLegs) {
      const key = accountKey(leg.userId, leg.asset);

      let balance = balances.get(key);
      if (balance === undefined) {
        balance = await this.getBalance(leg.userId, leg.asset, em);
      }

      const nextBalance =
        leg.direction === LedgerDirection.CREDIT
          ? addMoney(balance, leg.amount)
          : subtractMoney(balance, leg.amount);

      if (
        leg.direction === LedgerDirection.DEBIT &&
        !options.allowNegative &&
        compareMoney(nextBalance, ZERO_MONEY) < 0
      ) {
        throw new InsufficientFundsException(balance, leg.amount);
      }

      const entry = repo.create({
        transactionId,
        userId: leg.userId,
        direction: leg.direction,
        asset: leg.asset,
        amount: leg.amount,
        balanceAfter: nextBalance,
      });
      created.push(await repo.save(entry));

      balances.set(key, nextBalance);
    }

    this.logger.log(
      `Posted ${created.length} ledger entr${
        created.length === 1 ? 'y' : 'ies'
      } for transaction ${transactionId}`,
    );

    return created;
  }

  /** Normalise + validate a leg: positive amount, canonical asset/amount. */
  private validateLeg(leg: LedgerLeg): Required<LedgerLeg> {
    if (!isPositiveMoney(leg.amount)) {
      throw new BadRequestException(
        `Ledger amount must be greater than zero (got "${leg.amount}")`,
      );
    }

    return {
      userId: leg.userId,
      direction: leg.direction,
      amount: normalizeMoney(leg.amount),
      asset: leg.asset ?? DEFAULT_ASSET,
    };
  }

  /**
   * Take a transaction-scoped advisory lock on every distinct account touched,
   * in a deterministic (sorted) order so concurrent transfers can never
   * deadlock. Released automatically at commit/rollback.
   */
  private async lockAccounts(
    em: EntityManager,
    legs: Required<LedgerLeg>[],
  ): Promise<void> {
    const keys = Array.from(
      new Set(legs.map((leg) => accountKey(leg.userId, leg.asset))),
    ).sort();

    for (const key of keys) {
      // hashtext() maps each identifier to an int4 lock classid/objid pair.
      await em.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
        key,
        'ledger',
      ]);
    }
  }
}

/** Stable per-account key for locking and balance bookkeeping. */
function accountKey(userId: string, asset: string): string {
  return `${userId}:${asset}`;
}
