import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * wallets — one deposit address per user, derived from the master mnemonic
 * at derivation_index.
 *
 * WHERE IS THE USER'S CURRENT BALANCE?
 * It is NOT stored here. The source of truth for a user's spendable balance is
 * the append-only ledger: the `balance_after` of that user's most recent
 * ledger_entry. Storing a mutable balance column on the wallet would risk
 * drifting out of sync with the ledger and invites race conditions on
 * concurrent debits/credits. Read it from the ledger (latest balance_after)
 * or expose it via a service/DB view rather than a column here.
 *
 * `swept_balance` only tracks funds already swept from this deposit address to
 * the master wallet; it is NOT the user's balance. `asset` records the asset
 * (currently USDC). Money is numeric(18,6) as a string — never a JS float.
 */
@Entity('wallets')
export class Wallet extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index({ unique: true })
  @Column({ name: 'deposit_address' })
  depositAddress!: string;

  @Column({ name: 'derivation_index', type: 'int' })
  derivationIndex!: number;

  @Column({ length: 10, default: 'USDC' })
  asset!: string;

  @Column({ name: 'swept_balance', type: 'numeric', precision: 18, scale: 6, default: 0 })
  sweptBalance!: string;
}
