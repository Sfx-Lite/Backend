import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Not, Repository } from 'typeorm';

import { normalizeMoney } from '../../common/utils/money';
import { Transaction } from './entities/transaction.entity';
import { TransactionStatus } from './enums/transaction-status.enum';
import { TransactionType } from './enums/transaction-type.enum';

const DEFAULT_ASSET = 'USDC';

export interface CreateDepositInput {
  userId: string;
  amount: string;
  txHash: string;
  asset?: string;
  note?: string;
}

export interface CreateInternalTransferInput {
  fromUserId: string;
  toUserId: string;
  amount: string;
  asset?: string;
  note?: string | null;
}

export interface CreateWithdrawalInput {
  userId: string;
  amount: string;
  fee?: string;
  externalAddress: string;
  asset?: string;
  note?: string | null;
}

export interface CreateSweepInput {
  amount: string;
  txHash: string;
  asset?: string;
  note?: string | null;
}

/** A page of a user's transactions, plus the total for pagination. */
export interface PagedTransactions {
  items: Transaction[];
  total: number;
  limit: number;
  offset: number;
}

/** Filters + paging for a transaction-history query. */
export interface ListTransactionsOptions {
  limit: number;
  offset: number;
  /** ISO 8601 lower bound on created_at (inclusive). */
  from?: string;
  /** ISO 8601 upper bound on created_at (inclusive). */
  to?: string;
  /** Free-text, matched against id, counterparty username, and asset. */
  search?: string;
}

/** Filters + paging for the admin (all-users) transactions monitor. */
export interface ListAllTransactionsOptions {
  limit: number;
  offset: number;
  type?: TransactionType;
  status?: TransactionStatus;
  /** Restrict to transactions this user sent or received. */
  userId?: string;
  from?: string;
  to?: string;
  /** Free-text: id, asset, tx hash, external address. */
  search?: string;
}

/**
 * TransactionsService — Squad C (Payments & Ledger).
 * ──────────────────────────────────────────────────
 * The business-level transaction record a user sees. Each transaction fans out
 * into one or more append-only ledger_entries (see LedgerService). This service
 * owns the `transactions` row; the money movement itself is the ledger's job.
 *
 * Scaffolded to unblock Squad B's deposit watcher — deposit creation +
 * idempotency lookup are here now; internal-transfer / withdrawal / sweep
 * creation slot in alongside as those flows land.
 */
@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
  ) {}

  private repo(manager?: EntityManager): Repository<Transaction> {
    return manager ? manager.getRepository(Transaction) : this.transactions;
  }

  /**
   * Has this exact deposit already been recorded? Keyed on (txHash, toUserId)
   * so the watcher is safe to re-scan overlapping block ranges without ever
   * double-crediting a user — the idempotency guarantee from §03.
   */
  async findDepositByHashForUser(
    txHash: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<Transaction | null> {
    return this.repo(manager).findOne({
      where: { txHash, toUserId: userId, type: TransactionType.DEPOSIT },
    });
  }

  /**
   * Record a confirmed on-chain deposit. Status is SUCCESSFUL because the
   * watcher only calls this after N confirmations. Returns the persisted row so
   * the caller can attach ledger entries to its id.
   */
  async createDeposit(
    input: CreateDepositInput,
    manager?: EntityManager,
  ): Promise<Transaction> {
    const repo = this.repo(manager);

    const transaction = repo.create({
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.SUCCESSFUL,
      toUserId: input.userId,
      txHash: input.txHash,
      asset: input.asset ?? DEFAULT_ASSET,
      amount: normalizeMoney(input.amount),
      fee: normalizeMoney('0'),
      note: input.note ?? null,
    });

    return repo.save(transaction);
  }

  /**
   * Record an internal (user-to-user) transfer as a SUCCESSFUL transaction.
   * The paired debit/credit ledger entries are posted by the caller in the SAME
   * DB transaction (see TransfersService), so the row and the money move
   * atomically — either both commit or neither does.
   */
  async createInternalTransfer(
    input: CreateInternalTransferInput,
    manager?: EntityManager,
  ): Promise<Transaction> {
    const repo = this.repo(manager);

    const transaction = repo.create({
      type: TransactionType.INTERNAL_TRANSFER,
      status: TransactionStatus.SUCCESSFUL,
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      asset: input.asset ?? DEFAULT_ASSET,
      amount: normalizeMoney(input.amount),
      fee: normalizeMoney('0'),
      note: input.note ?? null,
    });

    return repo.save(transaction);
  }

  /**
   * Record a withdrawal as PROCESSING (money leaves the platform on-chain). The
   * caller debits the ledger (amount + fee) in the SAME transaction, then
   * broadcasts and later attaches the tx hash. `fee` is retained by the
   * platform — SUM(fee) over successful withdrawals is admin revenue.
   */
  async createWithdrawal(
    input: CreateWithdrawalInput,
    manager?: EntityManager,
  ): Promise<Transaction> {
    const repo = this.repo(manager);

    const transaction = repo.create({
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PROCESSING,
      fromUserId: input.userId,
      externalAddress: input.externalAddress,
      asset: input.asset ?? DEFAULT_ASSET,
      amount: normalizeMoney(input.amount),
      fee: normalizeMoney(input.fee ?? '0'),
      note: input.note ?? null,
    });

    return repo.save(transaction);
  }

  /**
   * Record a completed escrow sweep (deposit address → master wallet). Custody
   * plumbing only — the ledger is NOT touched, since the user was already
   * credited at deposit time. Status is SUCCESSFUL because the on-chain
   * transfer has been broadcast (and, for our purposes, recorded by hash).
   */
  async createSweep(
    input: CreateSweepInput,
    manager?: EntityManager,
  ): Promise<Transaction> {
    const repo = this.repo(manager);

    const transaction = repo.create({
      type: TransactionType.SWEEP,
      status: TransactionStatus.SUCCESSFUL,
      txHash: input.txHash,
      asset: input.asset ?? DEFAULT_ASSET,
      amount: normalizeMoney(input.amount),
      fee: normalizeMoney('0'),
      note: input.note ?? null,
    });

    return repo.save(transaction);
  }

  /** Attach the broadcast tx hash to a withdrawal once it hits the mempool. */
  async attachTxHash(
    transactionId: string,
    txHash: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.repo(manager).update({ id: transactionId }, { txHash });
  }

  /**
   * Withdrawals that have been broadcast (have a tx hash) but are still
   * PROCESSING — the confirmation job polls these to settle or refund them.
   */
  findProcessingWithdrawals(): Promise<Transaction[]> {
    return this.transactions.find({
      where: {
        type: TransactionType.WITHDRAWAL,
        status: TransactionStatus.PROCESSING,
        txHash: Not(IsNull()),
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * A page of the user's transactions — everything they sent OR received —
   * newest first, with optional date-range and free-text filtering. `id` is the
   * DESC tiebreaker so rows created in the same instant keep a stable order
   * across pages.
   *
   * `search` matches the transaction id, the asset, or the COUNTERPARTY's
   * username. Since the counterparty isn't a column on `transactions` (it's the
   * "other" user relative to the viewer), we join `users` on the computed
   * counterparty id to search by their username in one query.
   */
  async listForUser(
    userId: string,
    opts: ListTransactionsOptions,
  ): Promise<PagedTransactions> {
    const { limit, offset, from, to, search } = opts;

    const qb = this.transactions
      .createQueryBuilder('t')
      .where('(t.from_user_id = :userId OR t.to_user_id = :userId)', {
        userId,
      });

    if (from) {
      qb.andWhere('t.created_at >= :from', { from });
    }
    if (to) {
      qb.andWhere('t.created_at <= :to', { to });
    }

    if (search) {
      // Counterparty = the other party from the viewer's side.
      qb.leftJoin(
        'users',
        'cp',
        'cp.id = CASE WHEN t.to_user_id = :userId ' +
          'THEN t.from_user_id ELSE t.to_user_id END',
      ).andWhere(
        '(CAST(t.id AS TEXT) ILIKE :s OR t.asset ILIKE :s OR cp.username ILIKE :s)',
        { s: `%${search}%` },
      );
    }

    const [items, total] = await qb
      .orderBy('t.created_at', 'DESC')
      .addOrderBy('t.id', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return { items, total, limit, offset };
  }

  /**
   * ADMIN: a page of ALL transactions across every user, newest first, with
   * optional type / status / user / date-range / free-text filters. Not scoped
   * to a caller — this backs the admin transactions monitor.
   */
  async listAll(opts: ListAllTransactionsOptions): Promise<PagedTransactions> {
    const { limit, offset, type, status, userId, from, to, search } = opts;

    const qb = this.transactions.createQueryBuilder('t');

    if (type) {
      qb.andWhere('t.type = :type', { type });
    }
    if (status) {
      qb.andWhere('t.status = :status', { status });
    }
    if (userId) {
      qb.andWhere('(t.from_user_id = :userId OR t.to_user_id = :userId)', {
        userId,
      });
    }
    if (from) {
      qb.andWhere('t.created_at >= :from', { from });
    }
    if (to) {
      qb.andWhere('t.created_at <= :to', { to });
    }
    if (search) {
      qb.andWhere(
        '(CAST(t.id AS TEXT) ILIKE :s OR t.asset ILIKE :s OR ' +
          't.tx_hash ILIKE :s OR t.external_address ILIKE :s)',
        { s: `%${search}%` },
      );
    }

    const [items, total] = await qb
      .orderBy('t.created_at', 'DESC')
      .addOrderBy('t.id', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return { items, total, limit, offset };
  }

  /** ADMIN: a single transaction by id, regardless of who it belongs to. */
  findById(id: string): Promise<Transaction | null> {
    return this.transactions.findOne({ where: { id } });
  }

  /**
   * A single transaction the user is a party to (sender or recipient), or null.
   * The user-scoping is the authorization check — a user can never read a
   * transaction that isn't theirs, even with a valid id.
   */
  async findByIdForUser(
    id: string,
    userId: string,
  ): Promise<Transaction | null> {
    return this.transactions.findOne({
      where: [
        { id, fromUserId: userId },
        { id, toUserId: userId },
      ],
    });
  }

  /** Update a transaction's status (e.g. withdrawal processing → successful). */
  async markStatus(
    transactionId: string,
    status: TransactionStatus,
    manager?: EntityManager,
  ): Promise<void> {
    await this.repo(manager).update({ id: transactionId }, { status });
  }

  /**
   * Atomically move a transaction OUT of PROCESSING to `status`, but only if it
   * is still PROCESSING. Returns true if this call made the change — used so the
   * withdrawal refund path can't double-refund a row another path already
   * settled (the compare-and-set is the concurrency guard).
   */
  async markStatusIfProcessing(
    transactionId: string,
    status: TransactionStatus,
    manager?: EntityManager,
  ): Promise<boolean> {
    const result = await this.repo(manager).update(
      { id: transactionId, status: TransactionStatus.PROCESSING },
      { status },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Revenue summary over an optional created_at window. Counts SUCCESSFUL,
   * non-sweep transactions (sweeps are internal custody moves, not business
   * activity). `feeRevenue` is the platform's earnings — SUM(fee) — which today
   * comes entirely from withdrawal fees (transfers and deposits carry no fee).
   * Money values are returned as 6dp decimal strings; count as a number.
   */
  async getRevenueSummary(
    from?: Date,
    to?: Date,
  ): Promise<{
    totalTransactions: number;
    totalVolume: string;
    feeRevenue: string;
  }> {
    const qb = this.transactions
      .createQueryBuilder('t')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(t.amount), 0)::text', 'volume')
      .addSelect('COALESCE(SUM(t.fee), 0)::text', 'fee')
      .where('t.status = :status', { status: TransactionStatus.SUCCESSFUL })
      .andWhere('t.type != :sweep', { sweep: TransactionType.SWEEP });

    if (from) {
      qb.andWhere('t.created_at >= :from', { from });
    }
    if (to) {
      qb.andWhere('t.created_at <= :to', { to });
    }

    const row = await qb.getRawOne<{
      count: string;
      volume: string;
      fee: string;
    }>();

    return {
      totalTransactions: Number(row?.count ?? 0),
      totalVolume: normalizeMoney(row?.volume ?? '0'),
      feeRevenue: normalizeMoney(row?.fee ?? '0'),
    };
  }

  async getVolumeSince(from: Date): Promise<number> {
    const result = await this.transactions
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .where('t.status = :status', { status: TransactionStatus.SUCCESSFUL })
      .andWhere('t.type != :sweepType', { sweepType: TransactionType.SWEEP })
      .andWhere('t.created_at >= :from', { from })
      .getRawOne<{ total: string }>();

    return Number(result?.total ?? 0);
  }
}
