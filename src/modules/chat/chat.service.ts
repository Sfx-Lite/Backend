import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { performance } from 'node:perf_hooks';

import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatRole } from './enums/chat-role.enum';
import { RagService } from '../rag/rag.service';
import {
  CHAT_HISTORY_LIMIT,
  CHAT_RETRIEVAL_TOP_K,
  SYSTEM_PROMPT_BASE,
  buildContextBlock,
  logChatCall,
} from './chat.constants';
import { ChatMessageResponseDto } from './dto/chat-message-response.dto';
import { validatedEnv } from 'src/config/env.validation';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatConversation)
    private readonly conversationRepo: Repository<ChatConversation>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    private readonly ragService: RagService,
  ) {}

  async sendMessage(
    userId: string,
    message: string,
    conversationId?: string,
  ): Promise<ChatMessageResponseDto> {
    const conversation = await this.getOrCreateConversation(
      userId,
      conversationId,
    );

    await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: conversation.id,
        role: ChatRole.USER,
        content: message,
      }),
    );

    const history = await this.getRecentHistory(conversation.id);
    const retrievedChunks = await this.ragService.retrieve(
      message,
      CHAT_RETRIEVAL_TOP_K,
    );
    const systemPrompt = `${SYSTEM_PROMPT_BASE}\n\nContext:\n${buildContextBlock(retrievedChunks)}`;

    const grokMessages: GroqMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role:
          m.role === ChatRole.ASSISTANT
            ? ('assistant' as const)
            : ('user' as const),
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const model = validatedEnv.GROQ_MODEL ?? DEFAULT_GROQ_MODEL;
    const start = performance.now();

    try {
      const { reply, promptTokens, completionTokens, totalTokens } =
        await this.callGroq(grokMessages, model);
      const latencyMs = Math.round(performance.now() - start);

      const saved = await this.messageRepo.save(
        this.messageRepo.create({
          conversationId: conversation.id,
          role: ChatRole.ASSISTANT,
          content: reply,
          promptTokens,
          completionTokens,
          totalTokens,
          latencyMs,
        }),
      );

      logChatCall(this.logger, {
        model,
        promptTokens,
        completionTokens,
        conversationId: conversation.id,
        messageId: saved.id,
        timestamp: saved.createdAt,
        status: 'success',
      });

      return {
        conversationId: conversation.id,
        role: ChatRole.ASSISTANT,
        content: reply,
        createdAt: saved.createdAt,
      };
    } catch (error) {
      logChatCall(this.logger, {
        model,
        promptTokens: null,
        completionTokens: null,
        conversationId: conversation.id,
        messageId: null,
        timestamp: new Date(),
        status: 'failure',
      });
      throw error;
    }
  }

  private async getOrCreateConversation(
    userId: string,
    conversationId?: string,
  ): Promise<ChatConversation> {
    if (conversationId) {
      const existing = await this.conversationRepo.findOne({
        where: { id: conversationId, userId },
      });
      if (existing) return existing;
    }
    return this.conversationRepo.save(this.conversationRepo.create({ userId }));
  }

  private async getRecentHistory(
    conversationId: string,
  ): Promise<ChatMessage[]> {
    const messages = await this.messageRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: CHAT_HISTORY_LIMIT,
    });
    return messages.reverse();
  }

  private async callGroq(
    messages: GroqMessage[], // consider renaming this interface too, cosmetic only
    model: string,
  ): Promise<{
    reply: string;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  }> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not set');

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages }),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`Groq request failed: ${response.status} ${errText}`);
      throw new Error(`Groq request failed: ${response.status} ${errText}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    return {
      reply: data.choices[0].message.content,
      promptTokens: data.usage?.prompt_tokens ?? null,
      completionTokens: data.usage?.completion_tokens ?? null,
      totalTokens: data.usage?.total_tokens ?? null,
    };
  }
}
