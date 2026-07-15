import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { KycDocType } from '../enums/kyc-doc-type.enum';
import { KycSubmissionStatus } from '../enums/kyc-submission-status.enum';

/**
 * kyc_submissions — one row per document/selfie submission a user makes.
 * reviewed_by references the admin (users.id) who actioned it.
 */
@Entity('kyc_submissions')
export class KycSubmission extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'doc_type', type: 'enum', enum: KycDocType })
  docType!: KycDocType;

  @Column({ name: 'doc_url' })
  docUrl!: string;

  @Column({ name: 'selfie_url' })
  selfieUrl!: string;

  @Column({ type: 'enum', enum: KycSubmissionStatus, default: KycSubmissionStatus.PENDING })
  status!: KycSubmissionStatus;

  @Column({ type: 'varchar', nullable: true })
  reason?: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy?: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;
}
