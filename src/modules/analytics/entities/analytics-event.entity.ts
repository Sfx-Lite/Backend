import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * analytics_events — lightweight product analytics. user_id is nullable for
 * anonymous/pre-auth events. `properties` is arbitrary JSON per event type.
 * Events are immutable; updated_at (from BaseEntity) simply mirrors created_at.
 */
@Entity('analytics_events')
export class AnalyticsEvent extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Index()
  @Column()
  event!: string;

  @Column({ type: 'jsonb', nullable: true })
  properties?: Record<string, unknown> | null;
}
