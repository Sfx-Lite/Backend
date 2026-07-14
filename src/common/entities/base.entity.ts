import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * BaseEntity — shared columns every mutable table inherits: a uuid primary key
 * plus created/updated timestamps. Extend it to avoid repeating this boilerplate:
 *
 *   @Entity('things')
 *   export class Thing extends BaseEntity { ... }
 *
 * NOTE: append-only tables (ledger_entries, audit_log) intentionally do NOT
 * extend this — they must never carry an updated_at, so they declare their own
 * id + created_at with update:false.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
