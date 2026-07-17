import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * BaseEntity — shared columns EVERY entity inherits: a uuid primary key plus
 * created/updated timestamps. Extend it to avoid repeating this boilerplate:
 *
 *   @Entity('things')
 *   export class Thing extends BaseEntity { ... }
 *
 * On append-only tables (ledger_entries, audit_log, analytics_events, ...) the
 * business columns are marked update:false, so rows are still never mutated;
 * updated_at just mirrors created_at there.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
