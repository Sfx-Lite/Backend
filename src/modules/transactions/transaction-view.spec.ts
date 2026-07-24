import { Transaction } from './entities/transaction.entity';
import { TransactionStatus } from './enums/transaction-status.enum';
import { TransactionType } from './enums/transaction-type.enum';
import { counterpartyIdOf, toTransactionView } from './transaction-view';

const ALICE = 'alice-id';
const BOB = 'bob-id';

const tx = (over: Partial<Transaction>): Transaction =>
  ({
    id: 'tx-1',
    status: TransactionStatus.SUCCESSFUL,
    asset: 'USDC',
    amount: '10.000000',
    fee: '0.000000',
    note: null,
    fromUserId: null,
    toUserId: null,
    externalAddress: null,
    txHash: null,
    createdAt: new Date('2026-07-24T00:00:00Z'),
    ...over,
  }) as Transaction;

describe('toTransactionView', () => {
  const names = new Map([
    [ALICE, 'alice'],
    [BOB, 'bob'],
  ]);

  it('frames an outgoing transfer as a debit to the counterparty', () => {
    const view = toTransactionView(
      tx({
        type: TransactionType.INTERNAL_TRANSFER,
        fromUserId: ALICE,
        toUserId: BOB,
      }),
      ALICE,
      names,
    );

    expect(view.direction).toBe('debit');
    expect(view.counterpartyUserId).toBe(BOB);
    expect(view.counterpartyUsername).toBe('bob');
  });

  it('frames the same transfer as a credit for the recipient', () => {
    const view = toTransactionView(
      tx({
        type: TransactionType.INTERNAL_TRANSFER,
        fromUserId: ALICE,
        toUserId: BOB,
      }),
      BOB,
      names,
    );

    expect(view.direction).toBe('credit');
    expect(view.counterpartyUserId).toBe(ALICE);
    expect(view.counterpartyUsername).toBe('alice');
  });

  it('frames an on-chain deposit as a credit with no counterparty user', () => {
    const view = toTransactionView(
      tx({
        type: TransactionType.DEPOSIT,
        toUserId: BOB,
        txHash: '0xabc',
      }),
      BOB,
      names,
    );

    expect(view.direction).toBe('credit');
    expect(view.counterpartyUserId).toBeNull();
    expect(view.counterpartyUsername).toBeNull();
    expect(view.txHash).toBe('0xabc');
  });
});

describe('counterpartyIdOf', () => {
  it('returns the other party from the viewer\'s side', () => {
    const transfer = tx({ fromUserId: ALICE, toUserId: BOB });
    expect(counterpartyIdOf(transfer, ALICE)).toBe(BOB);
    expect(counterpartyIdOf(transfer, BOB)).toBe(ALICE);
  });

  it('returns null when there is no on-platform counterparty', () => {
    expect(counterpartyIdOf(tx({ toUserId: BOB }), BOB)).toBeNull();
  });
});
