import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * audit_log — append-only trail of privileged admin actions. `entity` +
 * entity_id identify what was acted on; `metadata` holds a JSON snapshot of
 * the change (before/after, reason, etc.). Append-only in practice;
 * updated_at (from BaseEntity) simply mirrors created_at.
 */
@Entity('audit_log')
export class AuditLog extends BaseEntity {
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
}
