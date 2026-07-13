import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum BeneficiaryType {
  INTERNAL = 'internal', // another SFx user (by username)
  EXTERNAL = 'external', // an on-chain address
}

/**
 * beneficiaries — a user's saved payees. `identifier` holds a username for
 * internal beneficiaries or a wallet address for external ones.
 */
@Entity('beneficiaries')
@Index(['userId', 'identifier'], { unique: true })
export class Beneficiary {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: BeneficiaryType })
  type!: BeneficiaryType;

  @Column()
  identifier!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
