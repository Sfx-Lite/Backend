import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ChatRole } from '../enums/chat-role.enum';

/**
 * chat_messages — individual turns within a conversation, in created_at order.
 * Messages are immutable in practice; updated_at (from BaseEntity) simply
 * mirrors created_at.
 */
@Entity('chat_messages')
export class ChatMessage extends BaseEntity {
  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @Column({ type: 'enum', enum: ChatRole })
  role!: ChatRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'prompt_tokens', type: 'int', nullable: true })
  promptTokens?: number | null;

  @Column({ name: 'completion_tokens', type: 'int', nullable: true })
  completionTokens?: number | null;

  @Column({ name: 'total_tokens', type: 'int', nullable: true })
  totalTokens?: number | null;

  @Column({ name: 'latency_ms', type: 'int', nullable: true })
  latencyMs?: number | null;
}
