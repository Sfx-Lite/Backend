import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * analytics_events — behavioral analytics across both actor surfaces
 * (User + Admin). user_id is required — anonymous/pre-auth events are
 * not tracked. actor_type distinguishes which surface fired the event.
 * `properties` is arbitrary JSON per event type. Events are immutable;
 * updated_at (from BaseEntity) simply mirrors created_at.
 */
@Entity('analytics_events')
export class AnalyticsEvent extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid', update: false })
  userId!: string;

  @Index()
  @Column({ name: 'event_name', update: false })
  eventName!: string;

  @Column({ name: 'actor_type', type: 'text', update: false })
  actorType!: 'user' | 'admin';

  @Column({ name: 'session_id', type: 'uuid', update: false })
  sessionId!: string;

  @Column({ type: 'jsonb', nullable: true })
  properties?: Record<string, unknown> | null;
}