import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserRole } from '../enums/user-role.enum';
import { KycStatus } from '../enums/kyc-status.enum';

/**
 * users — account + profile + KYC status.
 * password_hash is null for Google-only accounts; google_id is null for
 * password accounts. pin_hash gates sensitive money actions.
 */
@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 50 })
  username!: string;

  @Index({ unique: true })
  @Column()
  email!: string;

  // Collected at password registration and checked for duplicates in the
  // service layer. Nullable and NOT DB-unique so Google-only accounts (which
  // never supply a phone number) can still be created.
  @Column({
    name: 'mobile_number',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  mobileNumber?: string | null;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash?: string | null;

  @Index({ unique: true })
  @Column({ name: 'google_id', type: 'varchar', nullable: true })
  googleId?: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column({ name: 'pin_hash', type: 'varchar', nullable: true })
  pinHash?: string | null;

  @Column({ name: 'pin_failed_attempts', type: 'int', default: 0 })
  pinFailedAttempts!: number;

  @Column({ name: 'pin_locked_until', type: 'timestamptz', nullable: true })
  pinLockedUntil?: Date | null;

  /**
   * Login two-factor authentication toggle. When true, a one-time code is
   * emailed to the account on every login and must be entered to finish signing
   * in. Kept on the original `pin_2fa_enabled` column so no schema change is
   * needed — the mechanism is now email OTP rather than the transaction PIN.
   */
  @Column({ name: 'pin_2fa_enabled', type: 'boolean', default: false })
  twoFactorEnabled!: boolean;

  @Column({ name: 'first_name', type: 'varchar', nullable: true })
  firstName?: string | null;

  @Column({ name: 'middle_name', type: 'varchar', nullable: true })
  middleName?: string | null;

  @Column({ name: 'last_name', type: 'varchar', nullable: true })
  lastName?: string | null;

  @Column({ name: 'profile_image', type: 'varchar', nullable: true })
  profileImage?: string | null;

  @Column({ name: 'street_address_1', type: 'varchar', nullable: true })
  streetAddress1?: string | null;

  @Column({ name: 'street_address_2', type: 'varchar', nullable: true })
  streetAddress2?: string | null;

  @Column({ type: 'varchar', nullable: true })
  city?: string | null;

  @Column({ type: 'varchar', nullable: true })
  state?: string | null;

  @Column({ type: 'varchar', nullable: true })
  country?: string | null;

  /**
   * Account tier gating limits/features. Defaults to 1; valid values are 1, 2
   * and 3. Stored as a small integer so it is cheap to read on every profile
   * fetch and easy to range-check.
   */
  @Column({ type: 'smallint', default: 1 })
  tier!: number;

  /**
   * SHA-256 hash of the most recently issued password-reset token. The raw
   * token is emailed to the user and never stored, so a database leak cannot
   * be used to reset accounts. Cleared once the reset is consumed.
   */
  @Column({ name: 'password_reset_token', type: 'varchar', nullable: true })
  passwordResetToken?: string | null;

  @Column({
    name: 'password_reset_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  passwordResetExpiresAt?: Date | null;

  @Column({
    name: 'kyc_status',
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.UNVERIFIED,
  })
  kycStatus!: KycStatus;

  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true })
  suspendedAt?: Date | null;
}
