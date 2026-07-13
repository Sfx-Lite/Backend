import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum TransactionType {
  DEPOSIT = 'deposit',
  INTERNAL_TRANSFER = 'internal_transfer',
  WITHDRAWAL = 'withdrawal',
  SWEEP = 'sweep',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
}

/**
 * transactions — the business-level record a user sees. Each transaction fans
 * out into one or more append-only ledger_entries. from_user_id / to_user_id /
 * external_address are populated depending on `type`. tx_hash is the on-chain
 * hash for deposits/withdrawals/sweeps.
 */
@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: TransactionType })
  type!: TransactionType;

  @Index()
  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
  status!: TransactionStatus;

  @Index()
  @Column({ name: 'from_user_id', type: 'uuid', nullable: true })
  fromUserId?: string | null;

  @Index()
  @Column({ name: 'to_user_id', type: 'uuid', nullable: true })
  toUserId?: string | null;

  @Column({ name: 'external_address', nullable: true })
  externalAddress?: string | null;

  @Index()
  @Column({ name: 'tx_hash', nullable: true })
  txHash?: string | null;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ name: 'fee_usdc', type: 'numeric', precision: 18, scale: 6, default: 0 })
  feeUsdc!: string;

  @Column({ name: 'amount_usdc', type: 'numeric', precision: 18, scale: 6 })
  amountUsdc!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
