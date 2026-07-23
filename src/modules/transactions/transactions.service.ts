import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

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

  /** Update a transaction's status (e.g. withdrawal processing → successful). */
  async markStatus(
    transactionId: string,
    status: TransactionStatus,
    manager?: EntityManager,
  ): Promise<void> {
    await this.repo(manager).update({ id: transactionId }, { status });
  }
}
