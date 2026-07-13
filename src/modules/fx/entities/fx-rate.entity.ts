import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * fx_rates — snapshots of exchange rates used for display/quotes. Stored with
 * high precision numeric(18,8). `source` records where the rate came from.
 * Query the latest row per pair by created_at.
 */
@Entity('fx_rates')
@Index(['baseCurrency', 'quoteCurrency', 'createdAt'])
export class FxRate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'base_currency', length: 10 })
  baseCurrency!: string;

  @Column({ name: 'quote_currency', length: 10 })
  quoteCurrency!: string;

  @Column({ type: 'numeric', precision: 18, scale: 8 })
  rate!: string;

  @Column({ nullable: true })
  source?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
