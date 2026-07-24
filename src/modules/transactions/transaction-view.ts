import { Transaction } from './entities/transaction.entity';
import { TransactionStatus } from './enums/transaction-status.enum';
import { TransactionType } from './enums/transaction-type.enum';

/**
 * The shape the API returns for a transaction — flattened and framed from the
 * *viewer's* perspective, so the FE never has to reason about from/to itself:
 *
 *  - `direction` is 'credit' (money in) or 'debit' (money out) for THIS user.
 *  - `counterparty*` is the other party: the other user for internal transfers,
 *    or null for on-chain deposits/withdrawals (where `externalAddress`/`txHash`
 *    identify the chain side instead).
 */
export interface TransactionView {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  direction: 'credit' | 'debit';
  asset: string;
  amount: string;
  fee: string;
  note: string | null;
  counterpartyUserId: string | null;
  counterpartyUsername: string | null;
  externalAddress: string | null;
  txHash: string | null;
  createdAt: Date;
}

/**
 * Map a persisted transaction to its viewer-relative API shape. `usernameById`
 * is a pre-fetched id → username map (batched by the caller) so this stays a
 * pure, synchronous function with no DB access.
 */
export function toTransactionView(
  tx: Transaction,
  viewerId: string,
  usernameById: Map<string, string>,
): TransactionView {
  const isIncoming = tx.toUserId === viewerId;
  const counterpartyUserId = isIncoming
    ? tx.fromUserId ?? null
    : tx.toUserId ?? null;

  return {
    id: tx.id,
    type: tx.type,
    status: tx.status,
    direction: isIncoming ? 'credit' : 'debit',
    asset: tx.asset,
    amount: tx.amount,
    fee: tx.fee,
    note: tx.note ?? null,
    counterpartyUserId,
    counterpartyUsername: counterpartyUserId
      ? usernameById.get(counterpartyUserId) ?? null
      : null,
    externalAddress: tx.externalAddress ?? null,
    txHash: tx.txHash ?? null,
    createdAt: tx.createdAt,
  };
}

/** The counterparty user id for a transaction from the viewer's side, if any. */
export function counterpartyIdOf(
  tx: Transaction,
  viewerId: string,
): string | null {
  const isIncoming = tx.toUserId === viewerId;
  return (isIncoming ? tx.fromUserId : tx.toUserId) ?? null;
}
