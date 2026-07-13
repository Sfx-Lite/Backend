import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * audit_log — append-only trail of privileged admin actions. `entity` +
 * entity_id identify what was acted on; `metadata` holds a JSON snapshot of
 * the change (before/after, reason, etc.).
 */
@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'admin_id', type: 'uuid' })
  adminId!: string;

  @Column()
  action!: string;

  @Index()
  @Column()
  entity!: string;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
