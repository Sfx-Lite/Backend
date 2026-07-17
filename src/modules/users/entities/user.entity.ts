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

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash?: string | null;

  @Index({ unique: true })
  @Column({ name: 'google_id', type: 'varchar', nullable: true })
  googleId?: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column({ name: 'pin_hash', type: 'varchar', nullable: true })
  pinHash?: string | null;

  @Column({ name: 'first_name', type: 'varchar', nullable: true })
  firstName?: string | null;

  @Column({ name: 'last_name', type: 'varchar', nullable: true })
  lastName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  country?: string | null;

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
