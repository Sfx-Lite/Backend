import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatRole } from './enums/chat-role.enum';
import { RagService } from '../rag/rag.service';

describe('ChatService', () => {
  let service: ChatService;
  let conversationRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let messageRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock };
  let ragService: { retrieve: jest.Mock };
  let fetchMock: jest.MockedFunction<typeof fetch>;

  const USER_ID = 'user-123';
  const CONVERSATION_ID = 'conv-456';

  const mockGroqSuccessResponse = (overrides: Record<string, unknown> = {}) =>
    ({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Test reply from the model.' } }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
            total_tokens: 120,
          },
          ...overrides,
        }),
    }) as Response;

  // Reads one fetch() call's [url, init] pair with a non-null assertion —
  // safe here because each test only inspects a call it already knows
  // happened (asserted separately via toHaveBeenCalled elsewhere).
  const getFetchCall = (callIndex: number): [string, RequestInit] => {
    const call = fetchMock.mock.calls[callIndex];
    if (!call)
      throw new Error(`Expected fetch call at index ${callIndex} to exist`);
    return [call[0] as string, call[1] as RequestInit];
  };

  const getRequestBody = (
    init: RequestInit,
  ): { messages: { role: string; content: string }[] } =>
    JSON.parse(init.body as string) as {
      messages: { role: string; content: string }[];
    };

  const getAuthHeader = (init: RequestInit): string | undefined =>
    (init.headers as Record<string, string> | undefined)?.Authorization;

  // Reads one messageRepo.save() call's argument with the same
  // out-of-bounds guard as getFetchCall.
  const getSavedMessageArg = (callIndex: number): Partial<ChatMessage> => {
    const call = messageRepo.save.mock.calls[callIndex] as
      unknown[] | undefined;
    if (!call)
      throw new Error(
        `Expected messageRepo.save call at index ${callIndex} to exist`,
      );
    return call[0] as Partial<ChatMessage>;
  };

  beforeEach(async () => {
    conversationRepo = {
      findOne: jest.fn(),
      create: jest.fn((x: Partial<ChatConversation>) => x as ChatConversation),
      save: jest.fn(),
    };
    messageRepo = {
      create: jest.fn((x: Partial<ChatMessage>) => x as ChatMessage),
      save: jest.fn(),
      find: jest.fn(),
    };
    ragService = { retrieve: jest.fn().mockResolvedValue([]) };
    ragService = { retrieve: jest.fn().mockResolvedValue([]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getRepositoryToken(ChatConversation),
          useValue: conversationRepo,
        },
        { provide: getRepositoryToken(ChatMessage), useValue: messageRepo },
        { provide: RagService, useValue: ragService },
      ],
    }).compile();

    service = moduleRef.get(ChatService);

    process.env.GROQ_API_KEY = 'test-key';

    fetchMock = jest.fn().mockResolvedValue(mockGroqSuccessResponse());
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.GROQ_API_KEY;
  });

  describe('conversation handling', () => {
    it('creates a new conversation when no conversationId is provided', async () => {
      conversationRepo.save.mockResolvedValue({
        id: CONVERSATION_ID,
        userId: USER_ID,
      });
      messageRepo.find.mockResolvedValue([]);
      messageRepo.save.mockResolvedValue({
        id: 'msg-1',
        createdAt: new Date(),
      });

      await service.sendMessage(USER_ID, 'Hello');

      expect(conversationRepo.findOne).not.toHaveBeenCalled();
      expect(conversationRepo.create).toHaveBeenCalledWith({ userId: USER_ID });
      expect(conversationRepo.save).toHaveBeenCalled();
    });

    it('reuses an existing conversation when a valid conversationId is provided', async () => {
      conversationRepo.findOne.mockResolvedValue({
        id: CONVERSATION_ID,
        userId: USER_ID,
      });
      messageRepo.find.mockResolvedValue([]);
      messageRepo.save.mockResolvedValue({
        id: 'msg-1',
        createdAt: new Date(),
      });

      await service.sendMessage(USER_ID, 'Hello again', CONVERSATION_ID);

      expect(conversationRepo.findOne).toHaveBeenCalledWith({
        where: { id: CONVERSATION_ID, userId: USER_ID },
      });
      expect(conversationRepo.create).not.toHaveBeenCalled();
    });

    it('creates a new conversation if the given conversationId does not belong to this user', async () => {
      conversationRepo.findOne.mockResolvedValue(null);
      conversationRepo.save.mockResolvedValue({
        id: 'new-conv',
        userId: USER_ID,
      });
      messageRepo.find.mockResolvedValue([]);
      messageRepo.save.mockResolvedValue({
        id: 'msg-1',
        createdAt: new Date(),
      });

      await service.sendMessage(
        USER_ID,
        'Hello',
        'someone-elses-conversation-id',
      );

      expect(conversationRepo.create).toHaveBeenCalledWith({ userId: USER_ID });
    });
  });

  describe('context assembly', () => {
    beforeEach(() => {
      conversationRepo.save.mockResolvedValue({
        id: CONVERSATION_ID,
        userId: USER_ID,
      });
      messageRepo.save.mockResolvedValue({
        id: 'msg-1',
        createdAt: new Date(),
      });
    });

    it('calls RagService.retrieve with the user message', async () => {
      messageRepo.find.mockResolvedValue([]);

      await service.sendMessage(USER_ID, "Why can't I send money?");

      expect(ragService.retrieve).toHaveBeenCalledWith(
        "Why can't I send money?",
        expect.any(Number),
      );
    });

    it('includes prior conversation history in the Groq request, oldest first', async () => {
      messageRepo.find.mockResolvedValue([
        {
          role: ChatRole.USER,
          content: 'First question',
          createdAt: new Date('2026-01-01'),
        },
        {
          role: ChatRole.ASSISTANT,
          content: 'First answer',
          createdAt: new Date('2026-01-02'),
        },
      ]);

      await service.sendMessage(USER_ID, 'Follow-up question');

      const [, requestInit] = getFetchCall(0);
      const body = getRequestBody(requestInit);
      const roles = body.messages.map((m) => m.role);

      expect(roles).toEqual(['system', 'user', 'assistant', 'user']);
    });

    it('builds the system prompt using retrieved context when chunks are found', async () => {
      messageRepo.find.mockResolvedValue([]);
      ragService.retrieve.mockResolvedValue([
        { content: 'KYC required to send.', source: 'kyc-faq.md' },
      ]);

      await service.sendMessage(USER_ID, 'What is KYC?');

      const [, requestInit] = getFetchCall(0);
      const body = getRequestBody(requestInit);
      expect(body.messages[0]?.content).toContain('KYC required to send.');
    });

    it('tells the model no context was found when retrieval returns nothing', async () => {
      messageRepo.find.mockResolvedValue([]);
      ragService.retrieve.mockResolvedValue([]);

      await service.sendMessage(USER_ID, 'Some obscure question');

      const [, requestInit] = getFetchCall(0);
      const body = getRequestBody(requestInit);
      expect(body.messages[0]?.content).toContain(
        'No relevant context was found',
      );
    });
  });

  describe('Groq integration', () => {
    beforeEach(() => {
      conversationRepo.save.mockResolvedValue({
        id: CONVERSATION_ID,
        userId: USER_ID,
      });
      messageRepo.find.mockResolvedValue([]);
    });

    it('throws if GROQ_API_KEY is not set', async () => {
      delete process.env.GROQ_API_KEY;
      await expect(service.sendMessage(USER_ID, 'Hello')).rejects.toThrow(
        'GROQ_API_KEY is not set',
      );
    });

    it('sends the request to the Groq chat completions endpoint with the correct auth header', async () => {
      messageRepo.save.mockResolvedValue({
        id: 'msg-1',
        createdAt: new Date(),
      });

      await service.sendMessage(USER_ID, 'Hello');

      const [url, requestInit] = getFetchCall(0);
      expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
      expect(getAuthHeader(requestInit)).toBe('Bearer test-key');
    });

    it('throws and logs when Groq responds with a non-ok status', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      } as Response);

      await expect(service.sendMessage(USER_ID, 'Hello')).rejects.toThrow(
        'Groq request failed: 500',
      );
    });

    it('does not save an assistant message when the Groq call fails', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('error'),
      } as Response);

      await expect(service.sendMessage(USER_ID, 'Hello')).rejects.toThrow();

      expect(messageRepo.save).toHaveBeenCalledTimes(1);
      expect(messageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: ChatRole.USER }),
      );
    });
  });

  describe('token tracking', () => {
    beforeEach(() => {
      conversationRepo.save.mockResolvedValue({
        id: CONVERSATION_ID,
        userId: USER_ID,
      });
      messageRepo.find.mockResolvedValue([]);
    });

    it('saves prompt, completion, and total tokens separately from the usage response', async () => {
      messageRepo.save
        .mockResolvedValueOnce({ id: 'user-msg' })
        .mockResolvedValueOnce({ id: 'assistant-msg', createdAt: new Date() });

      await service.sendMessage(USER_ID, 'Hello');

      expect(getSavedMessageArg(1)).toEqual(
        expect.objectContaining({
          promptTokens: 100,
          completionTokens: 20,
          totalTokens: 120,
        }),
      );
    });

    it('saves null token values when Groq response has no usage field', async () => {
      fetchMock.mockResolvedValue(
        mockGroqSuccessResponse({ usage: undefined }),
      );
      messageRepo.save
        .mockResolvedValueOnce({ id: 'user-msg' })
        .mockResolvedValueOnce({ id: 'assistant-msg', createdAt: new Date() });

      await service.sendMessage(USER_ID, 'Hello');

      expect(getSavedMessageArg(1)).toEqual(
        expect.objectContaining({
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
        }),
      );
    });

    it('records latency as a non-negative number', async () => {
      messageRepo.save
        .mockResolvedValueOnce({ id: 'user-msg' })
        .mockResolvedValueOnce({ id: 'assistant-msg', createdAt: new Date() });

      await service.sendMessage(USER_ID, 'Hello');

      const savedAssistantMessage = getSavedMessageArg(1);
      expect(typeof savedAssistantMessage.latencyMs).toBe('number');
      expect(savedAssistantMessage.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('response shape', () => {
    it('returns only conversationId, role, content, and timestamp — no tokens or latency', async () => {
      conversationRepo.save.mockResolvedValue({
        id: CONVERSATION_ID,
        userId: USER_ID,
      });
      messageRepo.find.mockResolvedValue([]);
      const savedAt = new Date('2026-07-30T14:22:01.000Z');
      messageRepo.save
        .mockResolvedValueOnce({ id: 'user-msg' })
        .mockResolvedValueOnce({ id: 'assistant-msg', createdAt: savedAt });

      const result = await service.sendMessage(USER_ID, 'Hello');

      expect(result).toEqual({
        conversationId: CONVERSATION_ID,
        role: ChatRole.ASSISTANT,
        content: 'Test reply from the model.',
        timestamp: savedAt,
      });
      expect(result).not.toHaveProperty('tokens');
      expect(result).not.toHaveProperty('latencyMs');
    });
  });
});
