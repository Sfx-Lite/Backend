import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum LedgerDirection {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

/**
 * ledger_entries — APPEND-ONLY double-entry ledger. Rows are never updated or
 * deleted; a correction is a new compensating entry. balance_after is the
 * running balance for that user immediately after this entry. All writes
 * happen inside a DB transaction with a row lock on the user (Squad C).
 * Every column is update:false to make the append-only rule explicit.
 */
@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'transaction_id', type: 'uuid', update: false })
  transactionId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', update: false })
  userId!: string;

  @Column({ type: 'enum', enum: LedgerDirection, update: false })
  direction!: LedgerDirection;

  @Column({ name: 'amount_usdc', type: 'numeric', precision: 18, scale: 6, update: false })
  amountUsdc!: string;

  @Column({ name: 'balance_after', type: 'numeric', precision: 18, scale: 6, update: false })
  balanceAfter!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', update: false })
  createdAt!: Date;
}
