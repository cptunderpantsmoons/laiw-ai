import { randomUUID } from 'node:crypto';

import {
  type AgentTarget,
  type ChatMessage,
  type ChatMessageRole,
  type ToolDefinition,
  type AnyToolDefinition,
  type ChatStreamEvent,
  runChatTurn,
  streamChatCompletion,
  readChatStream,
} from '@teamsuzie/agent-loop';

import { ChatsStore } from '@teamsuzie/chats';
import type { Chat, ChatMessage as ChatStoreMessage } from '@teamsuzie/chats';

import { openDb, type DatabaseInstance } from '@teamsuzie/db-sqlite';
import { CHATS_MIGRATIONS } from '@teamsuzie/chats';

import { prisma } from '../models/prisma';

const STORAGE_DB_PATH = process.env.AI_STORAGE_DB ?? ':memory:';

// ---------------------------------------------------------------------------
// Agent target resolution — uses env, falls back to local models
// ---------------------------------------------------------------------------

function resolveAgentTarget(): AgentTarget {
  const baseUrl =
    process.env.OPENAI_BASE_URL ??
    process.env.ANTHROPIC_BASE_URL ??
    process.env.LLM_BASE_URL ??
    'https://api.openai.com';

  const apiKey =
    process.env.OPENAI_API_KEY ??
    process.env.ANTHROPIC_API_KEY ??
    process.env.LLM_API_KEY;

  const model =
    process.env.LLM_MODEL ??
    process.env.OPENAI_MODEL ??
    'gpt-4o';

  return { baseUrl, apiKey, model };
}

// ---------------------------------------------------------------------------
// ChatService
// ---------------------------------------------------------------------------

export interface ChatServiceOptions {
  store?: ChatsStore;
  db?: DatabaseInstance;
  agent?: AgentTarget;
  extraTools?: AnyToolDefinition[];
  systemPrompt?: string;
}

export interface ChatWithMessages {
  chat: Chat;
  messages: ChatStoreMessage[];
}

export class ChatService {
  private readonly store: ChatsStore;
  private readonly db: DatabaseInstance;
  private readonly agent: AgentTarget;
  private readonly extraTools: AnyToolDefinition[];
  private readonly systemPrompt: string;

  constructor(opts: ChatServiceOptions = {}) {
    this.db = opts.db ?? openDb({ path: STORAGE_DB_PATH, migrations: CHATS_MIGRATIONS });
    this.store = opts.store ?? new ChatsStore({ db: this.db, idFactory: randomUUID });
    this.agent = opts.agent ?? resolveAgentTarget();
    this.extraTools = opts.extraTools ?? [];
    this.systemPrompt =
      opts.systemPrompt ??
      process.env.SYSTEM_PROMPT ??
      'You are a legal AI assistant helping with legal document review, research, and drafting.';
  }

  // -- Chat CRUD -----------------------------------------------------------

  /**
   * Create a new chat within a matter/workspace.
   */
  async createChat(matterId: string, title?: string): Promise<{ chatId: string; messages: ChatStoreMessage[] }> {
    try {
      const chat = this.store.createChat({
        workspaceId: matterId,
        name: title || 'New chat',
      });
      return { chatId: chat.id, messages: this.store.listMessages(chat.id) };
    } catch (err) {
      console.error('[ChatService] Failed to create chat:', err);
      throw new Error(`Failed to create chat: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * List all chats for a given matter/workspace.
   */
  async listChats(matterId: string): Promise<Chat[]> {
    try {
      return this.store.listChats(matterId);
    } catch (err) {
      console.error('[ChatService] Failed to list chats:', err);
      return [];
    }
  }

  /**
   * Get a chat along with all its messages.
   */
  async getChat(chatId: string): Promise<ChatWithMessages | null> {
    try {
      const chat = this.store.getChat(chatId);
      if (!chat) return null;
      const messages = this.store.listMessages(chatId);
      return { chat, messages };
    } catch (err) {
      console.error('[ChatService] Failed to get chat:', err);
      return null;
    }
  }

  // -- Messaging -----------------------------------------------------------

  /**
   * Send a message to a chat and return the AI's response text.
   */
  async sendMessage(
    chatId: string,
    content: string,
    role: 'user' | 'system' = 'user',
  ): Promise<string> {
    try {
      // Save the incoming message
      this.store.appendMessage({
        chatId,
        role: role as 'user' | 'assistant',
        content,
      });

      // Build the conversation from store messages
      const storeMessages = this.store.listMessages(chatId);
      const agentMessages: ChatMessage[] = storeMessages.map((m) => ({
        role: m.role as ChatMessageRole,
        content: m.content,
      }));

      // Run a chat turn — the agent-loop handles tool-use loops internally
      let fullResponse = '';
      for await (const event of runChatTurn({
        agent: this.agent,
        messages: agentMessages,
        tools: this.extraTools,
        toolCtx: {
          approvals: {
            add: async () => ({ id: '', status: 'pending' } as any),
            approve: async () => {},
            reject: async () => {},
          } as any,
          vectorDbBaseUrl: process.env.VECTOR_DB_URL ?? 'http://localhost:3013',
          fetchImpl: fetch,
        },
        systemPrompt: this.systemPrompt,
      })) {
        if (event.type === 'chunk') {
          fullResponse += event.text;
        }
      }

      // Save the AI response
      if (fullResponse) {
        this.store.appendMessage({
          chatId,
          role: 'assistant',
          content: fullResponse,
        });
      }

      return fullResponse;
    } catch (err) {
      console.error('[ChatService] Failed to send message:', err);
      const errorMsg = `Failed to send message: ${err instanceof Error ? err.message : String(err)}`;
      this.store.appendMessage({
        chatId,
        role: 'assistant',
        content: errorMsg,
      });
      return errorMsg;
    }
  }

  /**
   * Stream chat: feed messages through the agent loop, emitting chunks via
   * the callback. Does NOT persist — it is a raw stream pass-through.
   *
   * Usage in a route handler:
   *   const writer = res.getWriter();
   *   await chatService.streamChat(matterId, messages, async (chunk) => {
   *     await writer.write(new TextEncoder().encode(chunk));
   *   });
   */
  async streamChat(
    matterId: string,
    messages: ChatMessage[],
    onChunk?: (chunk: string) => void | Promise<void>,
  ): Promise<void> {
    try {
      const agentMessages: ChatMessage[] = [
        ...messages,
      ];

      for await (const event of runChatTurn({
        agent: this.agent,
        messages: agentMessages,
        tools: this.extraTools,
        toolCtx: {
          approvals: {} as any,
          vectorDbBaseUrl: process.env.VECTOR_DB_URL ?? 'http://localhost:3013',
          fetchImpl: fetch,
        },
        systemPrompt: this.systemPrompt,
      })) {
        if (event.type === 'chunk') {
          if (onChunk) {
            await onChunk(event.text);
          }
        }
      }
    } catch (err) {
      console.error('[ChatService] Streaming chat failed:', err);
      throw new Error(`Streaming failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // -- DB management -------------------------------------------------------

  /** Close the underlying SQLite connection. */
  dispose(): void {
    try {
      this.db.close();
    } catch {
      // Ignore close errors
    }
  }
}
