import { Test } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatRole } from './enums/chat-role.enum';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: { sendMessage: jest.Mock };

  beforeEach(async () => {
    chatService = { sendMessage: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: chatService }],
    }).compile();

    controller = moduleRef.get(ChatController);
  });

  it('passes the authenticated user id (from @CurrentUser) and DTO fields through to the service', async () => {
    chatService.sendMessage.mockResolvedValue({
      conversationId: 'conv-1',
      role: ChatRole.ASSISTANT,
      content: 'reply',
      timestamp: new Date(),
    });

    await controller.sendMessage('user-123', {
      message: 'Hello',
      conversationId: 'conv-1',
    });

    expect(chatService.sendMessage).toHaveBeenCalledWith(
      'user-123',
      'Hello',
      'conv-1',
    );
  });

  it('passes undefined conversationId through when starting a new conversation', async () => {
    chatService.sendMessage.mockResolvedValue({
      conversationId: 'new-conv',
      role: ChatRole.ASSISTANT,
      content: 'reply',
      timestamp: new Date(),
    });

    await controller.sendMessage('user-123', { message: 'Hello' });

    expect(chatService.sendMessage).toHaveBeenCalledWith(
      'user-123',
      'Hello',
      undefined,
    );
  });
});
