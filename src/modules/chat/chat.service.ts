import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { performance } from 'node:perf_hooks';

import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatRole } from './enums/chat-role.enum';
import { ChatMessageStatus } from './enums/chat-message-status.enum';
import { RagService } from '../rag/rag.service';
import {
  CHAT_HISTORY_LIMIT,
  CHAT_RETRIEVAL_TOP_K,
  SYSTEM_PROMPT_BASE,
  buildContextBlock,
  buildConversationTitle,
  logChatCall,
  logRequestReceived,
  logConversationResolved,
  logUserMessageSaved,
  logRagRetrieval,
  logGroqCall,
  ChatLogContext,
} from './chat.constants';
import { SendMessageResponseDto } from './dto/send-message-response.dto.ts';
import { ConversationDetailResponseDto } from './dto/conversation-detail-response.dto';
import { ConversationSummaryDto } from './dto/conversation-summary.dto';

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
  ): Promise<SendMessageResponseDto> {
    const logCtx: ChatLogContext = {
      userId,
      conversationId: 'new',
      timestamp: new Date(),
    };
    logRequestReceived(
      this.logger,
      { ...logCtx, messageLength: message.length },
      conversationId ?? 'new',
    );
    const { conversation, isNew } = await this.getOrCreateConversation(
      userId,
      conversationId,
    );

    logConversationResolved(this.logger, {
      ...logCtx,
      conversationId: conversation.id,
      isNew,
    });

    if (isNew) {
      conversation.title = buildConversationTitle(message);
      await this.conversationRepo.save(conversation);
    }

    const userMsg = await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: conversation.id,
        role: ChatRole.USER,
        content: message,
        status: ChatMessageStatus.SUCCESS,
      }),
    );

    logUserMessageSaved(this.logger, {
      ...logCtx,
      conversationId: conversation.id,
      messageId: userMsg.id,
    });

    const history = await this.getRecentHistory(conversation.id);
    const retrievedChunks = await this.ragService.retrieve(
      message,
      CHAT_RETRIEVAL_TOP_K,
    );

    logRagRetrieval(this.logger, {
      ...logCtx,
      conversationId: conversation.id,
      chunkCount: retrievedChunks.length,
    });

    const systemPrompt = `${SYSTEM_PROMPT_BASE}\n\nContext:\n${buildContextBlock(retrievedChunks)}`;

    const groqMessages: GroqMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role:
          m.role === ChatRole.ASSISTANT
            ? ('assistant' as const)
            : ('user' as const),
        content: m.content ?? '',
      })),
      { role: 'user', content: message },
    ];

    const model = process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL;
    const start = performance.now();

    const groqStart = performance.now();

    try {
      const { reply, promptTokens, completionTokens, totalTokens } =
        await this.callGroq(groqMessages, model);
      const latencyMs = Math.round(performance.now() - start);

      const groqLatency = Math.round(performance.now() - groqStart);
      logGroqCall(this.logger, {
        ...logCtx,
        conversationId: conversation.id,
        model,
        latencyMs: groqLatency,
        ok: true,
      });

      const saved = await this.messageRepo.save(
        this.messageRepo.create({
          conversationId: conversation.id,
          role: ChatRole.ASSISTANT,
          content: reply,
          status: ChatMessageStatus.SUCCESS,
          model,
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
        message: {
          id: saved.id,
          createdAt: saved.createdAt,
          role: ChatRole.ASSISTANT,
          content: reply,
        },
      };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - start);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const groqLatency = Math.round(performance.now() - groqStart);
      logGroqCall(this.logger, {
        ...logCtx,
        conversationId: conversation.id,
        model,
        latencyMs: groqLatency,
        ok: false,
        status: 0,
      });

      const failedRow = await this.messageRepo.save(
        this.messageRepo.create({
          conversationId: conversation.id,
          role: ChatRole.ASSISTANT,
          content: null,
          status: ChatMessageStatus.FAILURE,
          model,
          errorMessage,
          latencyMs,
        }),
      );

      logChatCall(this.logger, {
        model,
        promptTokens: null,
        completionTokens: null,
        conversationId: conversation.id,
        messageId: failedRow.id,
        timestamp: failedRow.createdAt,
        status: 'failure',
      });

      throw error;
    }
  }

  async getConversation(
    userId: string,
    conversationId: string,
  ): Promise<ConversationDetailResponseDto> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId, userId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const messages = await this.messageRepo.find({
      where: {
        conversationId: conversation.id,
        status: ChatMessageStatus.SUCCESS,
      },
      order: { createdAt: 'ASC' },
    });

    return {
      id: conversation.id,
      createdAt: conversation.createdAt,
      conversationTitle: conversation.title ?? 'New conversation',
      messages: messages.map((m) => ({
        id: m.id,
        createdAt: m.createdAt,
        role: m.role,
        content: m.content ?? '',
      })),
    };
  }

  async listConversations(userId: string): Promise<ConversationSummaryDto[]> {
    const conversations = await this.conversationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const summaries = await Promise.all(
      conversations.map(async (conversation) => {
        const lastMessage = await this.messageRepo.findOne({
          where: {
            conversationId: conversation.id,
            status: ChatMessageStatus.SUCCESS,
          },
          order: { createdAt: 'DESC' },
        });

        return {
          id: conversation.id,
          createdAt: conversation.createdAt,
          conversationTitle: conversation.title ?? 'New conversation',
          lastMessageAt: lastMessage?.createdAt ?? conversation.createdAt,
        };
      }),
    );

    return summaries;
  }

  private async getOrCreateConversation(
    userId: string,
    conversationId?: string,
  ): Promise<{ conversation: ChatConversation; isNew: boolean }> {
    if (conversationId) {
      const existing = await this.conversationRepo.findOne({
        where: { id: conversationId, userId },
      });
      if (existing) return { conversation: existing, isNew: false };
    }

    const created = await this.conversationRepo.save(
      this.conversationRepo.create({ userId }),
    );
    return { conversation: created, isNew: true };
  }

  private async getRecentHistory(
    conversationId: string,
  ): Promise<ChatMessage[]> {
    const messages = await this.messageRepo.find({
      where: { conversationId, status: ChatMessageStatus.SUCCESS },
      order: { createdAt: 'DESC' },
      take: CHAT_HISTORY_LIMIT,
    });
    return messages.reverse();
  }

  private async callGroq(
    messages: GroqMessage[],
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
