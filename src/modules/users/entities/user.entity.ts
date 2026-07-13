import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum KycStatus {
  UNVERIFIED = 'unverified',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

/**
 * users — account + profile + KYC status.
 * password_hash is null for Google-only accounts; google_id is null for
 * password accounts. pin_hash gates sensitive money actions.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ length: 50 })
  username!: string;

  @Index({ unique: true })
  @Column()
  email!: string;

  @Column({ name: 'password_hash', nullable: true })
  passwordHash?: string | null;

  @Index({ unique: true })
  @Column({ name: 'google_id', nullable: true })
  googleId?: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column({ name: 'pin_hash', nullable: true })
  pinHash?: string | null;

  @Column({ name: 'first_name', nullable: true })
  firstName?: string | null;

  @Column({ name: 'last_name', nullable: true })
  lastName?: string | null;

  @Column({ nullable: true })
  country?: string | null;

  @Column({ name: 'kyc_status', type: 'enum', enum: KycStatus, default: KycStatus.UNVERIFIED })
  kycStatus!: KycStatus;

  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true })
  suspendedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
