import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SendMessageResponseDto } from './dto/send-message-response.dto.ts';
import { ConversationDetailResponseDto } from './dto/conversation-detail-response.dto';
import { ConversationSummaryDto } from './dto/conversation-summary.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  @ApiOperation({ summary: 'Send a message to the AI support assistant' })
  @ApiResponse({ status: 200, type: SendMessageResponseDto })
  async sendMessage(
    @CurrentUser('sub') userId: string,
    @Body() dto: SendMessageDto,
  ): Promise<SendMessageResponseDto> {
    return this.chatService.sendMessage(
      userId,
      dto.message,
      dto.conversationId,
    );
  }

  @Get('conversations')
  @ApiOperation({ summary: "List the current user's conversations" })
  @ApiResponse({ status: 200, type: [ConversationSummaryDto] })
  async listConversations(
    @CurrentUser('sub') userId: string,
  ): Promise<ConversationSummaryDto[]> {
    return this.chatService.listConversations(userId) as Promise<
      ConversationSummaryDto[]
    >;
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation and its messages' })
  @ApiResponse({ status: 200, type: ConversationDetailResponseDto })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found or does not belong to this user',
  })
  async getConversation(
    @CurrentUser('sub') userId: string,
    @Param('id') conversationId: string,
  ): Promise<ConversationDetailResponseDto> {
    return this.chatService.getConversation(userId, conversationId);
  }
}
