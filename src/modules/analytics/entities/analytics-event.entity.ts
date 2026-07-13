import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * analytics_events — lightweight product analytics. user_id is nullable for
 * anonymous/pre-auth events. `properties` is arbitrary JSON per event type.
 */
@Entity('analytics_events')
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Index()
  @Column()
  event!: string;

  @Column({ type: 'jsonb', nullable: true })
  properties?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
