import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { LedgerEntry } from './entities/ledger-entry.entity';
import { LedgerDirection } from './enums/ledger-direction.enum';
import { LedgerService } from './ledger.service';
import { InsufficientFundsException } from './exceptions/insufficient-funds.exception';

const ALICE = 'alice-user-id';
const BOB = 'bob-user-id';
const TX = 'tx-1';

/**
 * A tiny in-memory stand-in for the ledger repository: append-only store with a
 * findOne that mimics `ORDER BY created_at DESC, id DESC` (latest wins). The
 * same store backs both `this.entries` and `manager.getRepository(...)`, so a
 * balance read sees everything a prior post wrote.
 */
function makeStore() {
  const rows: LedgerEntry[] = [];
  let seq = 0;

  const repo = {
    findOne: jest.fn(
      ({ where }: { where: { userId: string; asset: string } }) => {
        const matches = rows.filter(
          (r) => r.userId === where.userId && r.asset === where.asset,
        );
        return Promise.resolve(matches.length ? matches[matches.length - 1] : null);
      },
    ),
    create: jest.fn((value: Partial<LedgerEntry>) => ({ ...value }) as LedgerEntry),
    save: jest.fn((value: LedgerEntry) => {
      const persisted = { ...value, id: `entry-${(seq += 1)}` } as LedgerEntry;
      rows.push(persisted);
      return Promise.resolve(persisted);
    }),
  };

  return { rows, repo };
}

describe('LedgerService', () => {
  let store: ReturnType<typeof makeStore>;
  let manager: EntityManager;
  let service: LedgerService;

  beforeEach(() => {
    store = makeStore();

    // EntityManager mock: advisory-lock query is a no-op; getRepository routes
    // to the shared in-memory store.
    manager = {
      query: jest.fn(() => Promise.resolve([])),
      getRepository: () => store.repo,
    } as unknown as EntityManager;

    const dataSource = {
      transaction: jest.fn((cb: (em: EntityManager) => Promise<unknown>) =>
        cb(manager),
      ),
    };

    service = new LedgerService(
      store.repo as unknown as Repository<LedgerEntry>,
      dataSource as unknown as DataSource,
    );
  });

  it('returns zero for an account with no entries', async () => {
    await expect(service.getBalance(ALICE)).resolves.toBe('0.000000');
  });

  it('credits an account and records balance_after', async () => {
    const entry = await service.credit(TX, ALICE, '10.5', 'USDC', manager);

    expect(entry.direction).toBe(LedgerDirection.CREDIT);
    expect(entry.amount).toBe('10.500000');
    expect(entry.balanceAfter).toBe('10.500000');
    await expect(service.getBalance(ALICE, 'USDC', manager)).resolves.toBe(
      '10.500000',
    );
  });

  it('accumulates sequential credits and debits exactly', async () => {
    await service.credit(TX, ALICE, '10', 'USDC', manager);
    await service.credit('tx-2', ALICE, '0.25', 'USDC', manager);
    const debit = await service.debit('tx-3', ALICE, '2.75', 'USDC', manager);

    expect(debit.direction).toBe(LedgerDirection.DEBIT);
    expect(debit.balanceAfter).toBe('7.500000');
  });

  it('rejects a debit that would overdraw the balance', async () => {
    await service.credit(TX, ALICE, '5', 'USDC', manager);

    await expect(
      service.debit('tx-2', ALICE, '5.000001', 'USDC', manager),
    ).rejects.toBeInstanceOf(InsufficientFundsException);

    // Nothing beyond the initial credit should have been written.
    expect(store.rows).toHaveLength(1);
    await expect(service.getBalance(ALICE, 'USDC', manager)).resolves.toBe(
      '5.000000',
    );
  });

  it('transfers atomically: sender debited, recipient credited', async () => {
    await service.credit(TX, ALICE, '20', 'USDC', manager);

    const [debit, credit] = await service.transfer(
      'tx-2',
      ALICE,
      BOB,
      '8',
      'USDC',
      manager,
    );

    expect(debit.userId).toBe(ALICE);
    expect(debit.balanceAfter).toBe('12.000000');
    expect(credit.userId).toBe(BOB);
    expect(credit.balanceAfter).toBe('8.000000');
    expect(credit.transactionId).toBe('tx-2');
  });

  it('rejects a transfer to the same account', async () => {
    await expect(
      service.transfer(TX, ALICE, ALICE, '1', 'USDC', manager),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-positive amounts', async () => {
    await expect(
      service.credit(TX, ALICE, '0', 'USDC', manager),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.credit(TX, ALICE, '-1', 'USDC', manager),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acquires a per-account advisory lock before writing', async () => {
    await service.credit(TX, ALICE, '10', 'USDC', manager);
    (manager.query as jest.Mock).mockClear();

    await service.transfer('tx-2', ALICE, BOB, '3', 'USDC', manager);

    const lockCalls = (manager.query as jest.Mock).mock.calls.filter(
      ([sql]: [string]) => sql.includes('pg_advisory_xact_lock'),
    );
    // One lock per distinct account touched (Alice + Bob).
    expect(lockCalls).toHaveLength(2);
  });
});
