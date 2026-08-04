import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ChatRole } from '../enums/chat-role.enum';
import { ChatMessageStatus } from '../enums/chat-message-status.enum';

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

  @Column({ name: 'prompt_tokens', type: 'int', nullable: true })
  promptTokens?: number | null;

  @Column({ name: 'completion_tokens', type: 'int', nullable: true })
  completionTokens?: number | null;

  @Column({ name: 'total_tokens', type: 'int', nullable: true })
  totalTokens?: number | null;

  @Column({ name: 'latency_ms', type: 'int', nullable: true })
  latencyMs?: number | null;

  @Column({ type: 'text', nullable: true })
  content?: string | null;

  @Column({
    type: 'enum',
    enum: ChatMessageStatus,
    default: ChatMessageStatus.SUCCESS,
  })
  status!: ChatMessageStatus;

  @Column({ type: 'varchar', nullable: true })
  model?: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;
}
