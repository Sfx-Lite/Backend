import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum KycDocType {
  PASSPORT = 'passport',
  NATIONAL_ID = 'national_id',
}

export enum KycSubmissionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * kyc_submissions — one row per document/selfie submission a user makes.
 * reviewed_by references the admin (users.id) who actioned it.
 */
@Entity('kyc_submissions')
export class KycSubmission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

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

  @Column({ nullable: true })
  reason?: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy?: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
