import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * wallets — one deposit address per user, derived from the master mnemonic
 * at derivation_index. swept_balance_usdc tracks funds already swept to the
 * master wallet (source of truth for balances is the ledger, not this field).
 * Money is numeric(18,6) as a string — never a JS float.
 */
@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index({ unique: true })
  @Column({ name: 'deposit_address' })
  depositAddress!: string;

  @Column({ name: 'derivation_index', type: 'int' })
  derivationIndex!: number;

  @Column({ name: 'swept_balance_usdc', type: 'numeric', precision: 18, scale: 6, default: 0 })
  sweptBalanceUsdc!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
