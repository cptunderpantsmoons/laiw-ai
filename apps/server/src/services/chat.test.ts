import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';

// Use vi.hoisted() to lift everything above vi.mock()
const hoisted = vi.hoisted(() => {
  class MockDb {
    close() { /* no-op */ }
  }

  class MockChatsStore {
    private chats: Record<string, any> = {};
    private messages: Record<string, any[]> = {};

    createChat(input: any) {
      const id = randomUUID();
      const now = Date.now();
      const chat = { id, workspaceId: input.workspaceId, name: input.name || 'New chat', personaId: null, createdAt: now, updatedAt: now };
      this.chats[id] = chat;
      this.messages[id] = [];
      return chat;
    }

    getChat(id: string) {
      return this.chats[id] ?? null;
    }

    listChats(workspaceId: string) {
      return Object.values(this.chats).filter((c: any) => c.workspaceId === workspaceId);
    }

    listMessages(chatId: string) {
      return this.messages[chatId] ?? [];
    }

    appendMessage(input: any) {
      const id = randomUUID();
      const now = Date.now();
      const msg = { id, chatId: input.chatId, role: input.role, content: input.content, toolEvents: input.toolEvents ?? null, citations: input.citations ?? null, createdAt: now };
      if (!this.messages[input.chatId]) this.messages[input.chatId] = [];
      this.messages[input.chatId].push(msg);
      return msg;
    }

    touchChat() { /* no-op */ }
  }

  return { MockDb, MockChatsStore };
});

vi.mock('@teamsuzie/db-sqlite', () => ({
  openDb: () => new hoisted.MockDb(),
}));

vi.mock('@teamsuzie/chats', () => ({
  CHATS_MIGRATIONS: [],
  ChatsStore: hoisted.MockChatsStore,
}));

vi.mock('@teamsuzie/agent-loop', () => ({
  runChatTurn: vi.fn().mockImplementation(async function* () {
    yield { type: 'chunk', text: 'Mock AI response' };
  }),
  streamChatCompletion: vi.fn(),
  readChatStream: vi.fn(),
}));

import { ChatService } from './chat-service';

describe('ChatService', () => {
  let chatService: ChatService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    try { chatService?.dispose(); } catch { /* ignore */ }
  });

  describe('createChat', () => {
    it('should create a chat with a default title', async () => {
      chatService = new ChatService();
      const result = await chatService.createChat('matter-1');

      expect(result.chatId).toBeDefined();
      expect(result.messages).toEqual([]);
    });

    it('should create a chat with a provided title', async () => {
      chatService = new ChatService();
      const result = await chatService.createChat('matter-1', 'Contract review chat');

      expect(result.chatId).toBeDefined();
      expect(result.messages).toEqual([]);
    });
  });

  describe('listChats', () => {
    it('should list chats for a matter', async () => {
      chatService = new ChatService();
      await chatService.createChat('matter-1', 'Chat A');
      await chatService.createChat('matter-1', 'Chat B');
      await chatService.createChat('matter-2', 'Chat C');

      const matter1Chats = await chatService.listChats('matter-1');
      expect(matter1Chats.length).toBe(2);

      const matter2Chats = await chatService.listChats('matter-2');
      expect(matter2Chats.length).toBe(1);
      expect(matter2Chats[0].name).toBe('Chat C');
    });
  });

  describe('getChat', () => {
    it('should return a chat with messages', async () => {
      chatService = new ChatService();
      const { chatId } = await chatService.createChat('matter-1', 'Get chat test');

      await chatService.sendMessage(chatId, 'Hello AI');

      const result = await chatService.getChat(chatId);

      expect(result).not.toBeNull();
      expect(result!.chat.id).toBe(chatId);
      expect(result!.chat.name).toBe('Get chat test');
      expect(result!.messages.length).toBeGreaterThanOrEqual(1);
    });

    it('should return null for non-existent chat', async () => {
      chatService = new ChatService();
      const result = await chatService.getChat('nonexistent-chat-id');
      expect(result).toBeNull();
    });
  });

  describe('sendMessage', () => {
    it('should append a user message and return AI response', async () => {
      chatService = new ChatService();
      const { chatId } = await chatService.createChat('matter-1', 'Send message test');

      const response = await chatService.sendMessage(chatId, 'What is contract law?');

      expect(response).toBe('Mock AI response');
    });

    it('should handle system role messages', async () => {
      chatService = new ChatService();
      const { chatId } = await chatService.createChat('matter-1', 'System message test');

      const response = await chatService.sendMessage(chatId, 'System instruction', 'system');
      expect(response).toBe('Mock AI response');
    });
  });

  describe('streamChat', () => {
    it('should stream chunks via callback', async () => {
      chatService = new ChatService();
      const chunks: string[] = [];

      await chatService.streamChat('matter-1', [] as any, (chunk) => {
        chunks.push(chunk);
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks).toContain('Mock AI response');
    });
  });

  describe('dispose', () => {
    it('should close the underlying database', () => {
      chatService = new ChatService();
      expect(() => chatService.dispose()).not.toThrow();
    });
  });
});
