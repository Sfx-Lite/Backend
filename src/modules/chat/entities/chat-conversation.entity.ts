import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * chat_conversations — one AI support thread per row. Messages hang off it via
 * chat_messages.conversation_id.
 */
@Entity('chat_conversations')
export class ChatConversation extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', nullable: true })
  title?: string | null;
}
