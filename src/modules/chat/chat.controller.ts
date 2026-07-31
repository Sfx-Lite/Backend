import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatMessageResponseDto } from './dto/chat-message-response.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  @ApiOperation({
    summary: 'Send a message to the AI support assistant',
    description:
      'Omit conversationId to start a new conversation. The assistant answers only from SFx Lite knowledge-base context.',
  })
  @ApiResponse({
    status: 200,
    description: 'Assistant replied successfully.',
    type: ChatMessageResponseDto,
    schema: {
      example: {
        conversationId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        role: 'assistant',
        content:
          "You'll need to complete KYC verification before you can send funds or withdraw.",
        createdAt: '2026-07-30T14:22:01.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation failed — message is missing or conversationId is not a valid UUID.',
    schema: {
      example: {
        statusCode: 400,
        message: ['message must be a string', 'conversationId must be a UUID'],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'The AI provider (Grok) request failed or is unavailable.',
    schema: {
      example: {
        statusCode: 503,
        message: 'Grok request failed: 500 Internal Server Error',
        error: 'Service Unavailable',
      },
    },
  })
  async sendMessage(
    @CurrentUser('sub') userId: string,
    @Body() dto: SendMessageDto,
  ): Promise<ChatMessageResponseDto> {
    return this.chatService.sendMessage(
      userId,
      dto.message,
      dto.conversationId,
    );
  }
}
