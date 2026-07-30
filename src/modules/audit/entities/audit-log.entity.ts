import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';
import { AuditCategory } from '../enums/audit-category.enum';
import { AuditLevel } from '../enums/audit-level.enum';

/**
 * audit_log — append-only trail of everything worth remembering across the
 * platform: admin governance actions, KYC decisions, money movements, auth
 * events, and system jobs.
 *
 * `actor_id` is whoever performed the action — an admin, a user, or null for
 * automated/system events. `category` is the owning domain (the filter slug),
 * `level` the severity for triage. `entity` + `entity_id` identify what was
 * acted on; `metadata` holds a JSON snapshot (before/after, reason, amounts).
 *
 * Append-only in practice: rows are only ever inserted; a correction is a new
 * row. updated_at (from BaseEntity) simply mirrors created_at.
 */
@Entity('audit_log')
export class AuditLog extends BaseEntity {
  @Index()
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string | null;

  @Index()
  @Column({ type: 'enum', enum: AuditCategory, default: AuditCategory.SYSTEM })
  category!: AuditCategory;

  @Index()
  @Column({ type: 'enum', enum: AuditLevel, default: AuditLevel.NORMAL })
  level!: AuditLevel;

  /** A short, stable verb for the event, e.g. "user.suspended", "kyc.approved". */
  @Column()
  action!: string;

  /** The kind of thing acted on, e.g. "user", "kyc_submission", "transaction". */
  @Index()
  @Column({ type: 'varchar', nullable: true })
  entity?: string | null;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;
}
