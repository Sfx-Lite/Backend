import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TransactionType } from '../enums/transaction-type.enum';
import { TransactionStatus } from '../enums/transaction-status.enum';

/**
 * transactions — the business-level record a user sees. Each transaction fans
 * out into one or more append-only ledger_entries. from_user_id / to_user_id /
 * external_address are populated depending on `type`. tx_hash is the on-chain
 * hash for deposits/withdrawals/sweeps.
 *
 * `amount` and `fee` are asset-agnostic numerics; `asset` records the asset
 * they're denominated in (currently USDC) so more assets can be added later
 * without a schema change.
 */
@Entity('transactions')
export class Transaction extends BaseEntity {
  @Column({ type: 'enum', enum: TransactionType })
  type!: TransactionType;

  @Index()
  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status!: TransactionStatus;

  @Index()
  @Column({ name: 'from_user_id', type: 'uuid', nullable: true })
  fromUserId?: string | null;

  @Index()
  @Column({ name: 'to_user_id', type: 'uuid', nullable: true })
  toUserId?: string | null;

  @Column({ name: 'external_address', type: 'varchar', nullable: true })
  externalAddress?: string | null;

  @Index()
  @Column({ name: 'tx_hash', type: 'varchar', nullable: true })
  txHash?: string | null;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ length: 10, default: 'USDC' })
  asset!: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 0 })
  fee!: string;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  amount!: string;
}
