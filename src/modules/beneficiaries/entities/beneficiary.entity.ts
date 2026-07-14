import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { BeneficiaryType } from '../enums/beneficiary-type.enum';

/**
 * beneficiaries — a user's saved payees. `identifier` holds a username for
 * internal beneficiaries or a wallet address for external ones.
 */
@Entity('beneficiaries')
@Index(['userId', 'identifier'], { unique: true })
export class Beneficiary extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: BeneficiaryType })
  type!: BeneficiaryType;

  @Column()
  identifier!: string;
}
