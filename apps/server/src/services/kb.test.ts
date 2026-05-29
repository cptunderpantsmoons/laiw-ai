import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';

// Shared mock KB store instance
const mockKbStore = {
  _insertReject: null as Error | null,
  _searchResult: null as any[] | null,
  _searchReject: null as Error | null,
  docs: {} as Record<string, any>,

  async insert(input: any) {
    if (this._insertReject) throw this._insertReject;
    const id = randomUUID();
    const doc = { id, name: input.name, chunkCount: 3, createdAt: new Date() };
    this.docs[id] = doc;
    return doc;
  },

  async search(_query: string, _opts: any) {
    if (this._searchReject) throw this._searchReject;
    return this._searchResult ?? [
      { document: { id: 'doc-1', name: 'Contract v1' }, chunk: { chunkIndex: 0, content: 'relevant text' }, distance: 0.1 },
    ];
  },

  list(_orgId: string) { return Object.values(this.docs); },
  delete(docId: string) { if (this.docs[docId]) { delete this.docs[docId]; return true } return false; },
};

vi.mock('@teamsuzie/db-sqlite', () => ({
  openDb: () => ({ close() {} }),
}));

vi.mock('@teamsuzie/kb', () => ({
  KnowledgeBaseStore: class {
    constructor() { Object.assign(this, mockKbStore); }
  },
  chunkMarkdown: (text: string) => {
    if (!text.trim()) return [];
    return text.split(/\n\s*\n/).filter((p: string) => p.trim()).map((p: string) => ({ content: p.trim(), startChar: 0, endChar: p.length }));
  },
  createOpenAIEmbedder: () => ({}),
  createKbSearchTool: () => ({ name: 'kb_search' }),
  KB_MIGRATIONS: [],
}));

vi.mock('@teamsuzie/chats', () => ({
  Db: class { close() {} },
  ChatsStore: class {
    createSession() { return { id: 'chat-1' }; }
    listSessions() { return [{ id: 'chat-1', title: 'Test' }]; }
    getMessages() { return []; }
    addMessage() { return { id: 'msg-1', role: 'user', content: 'hello', createdAt: new Date() }; }
  },
}));

import { KBService } from './kb-service';

describe('KBService', () => {
  let kbService: KBService;

  beforeEach(() => {
    vi.clearAllMocks();
    (mockKbStore as any)._insertReject = null;
    (mockKbStore as any)._searchResult = null;
    (mockKbStore as any)._searchReject = null;
    (mockKbStore as any).docs = {};
  });

  describe('insertDocument', () => {
    it('should insert a document and return doc ID', async () => {
      kbService = new KBService();
      const result = await kbService.insertDocument('org-1', 'Test content', 'Test Doc');
      expect(result).toHaveProperty('docId');
      expect(result).toHaveProperty('chunks');
    });

    it('should throw on insert failure', async () => {
      (mockKbStore as any)._insertReject = new Error('Indexing failed');
      kbService = new KBService();
      await expect(kbService.insertDocument('org-1', 'Bad content', 'Bad Doc')).rejects.toThrow('Failed to insert document');
    });
  });

  describe('searchKB', () => {
    it('should search KB and return results', async () => {
      kbService = new KBService();
      const results = await kbService.searchKB('org-1', 'contract');
      expect(results).toHaveProperty('results');
      expect(Array.isArray(results.results)).toBe(true);
    });

    it('should return empty results on search error', async () => {
      (mockKbStore as any)._searchReject = new Error('Search failed');
      kbService = new KBService();
      const results = await kbService.searchKB('org-1', 'query');
      expect(results).toEqual({ results: [] });
    });
  });

  describe('chunkAndIndex', () => {
    it('should return 0 for empty text', async () => {
      kbService = new KBService();
      const count = await kbService.chunkAndIndex('org-1', '');
      expect(count).toBe(0);
    });

    it('should throw on chunk failure', async () => {
      (mockKbStore as any)._insertReject = new Error('Indexing failed');
      kbService = new KBService();
      await expect(kbService.chunkAndIndex('org-1', 'some text')).rejects.toThrow('Failed to chunk and index');
    });
  });

  describe('listDocuments', () => {
    it('should list documents for org', async () => {
      kbService = new KBService();
      await kbService.insertDocument('org-1', Buffer.from('test') as any, 'Test Doc');
      const docs = kbService.listDocuments('org-1');
      expect(docs).toHaveLength(1);
    });
  });

  describe('deleteDocument', () => {
    it('should return true for existing doc', () => {
      kbService = new KBService();
      kbService.insertDocument('org-1', Buffer.from('x') as any, 'Test');
      const docs = (mockKbStore as any).docs;
      const docId = Object.keys(docs)[0];
      const result = kbService.deleteDocument(docId);
      expect(result).toBe(true);
    });

    it('should return false for non-existent doc', () => {
      kbService = new KBService();
      const result = kbService.deleteDocument('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('createSearchTool', () => {
    it('should return a kb search tool definition', () => {
      kbService = new KBService();
      const tool = kbService.createSearchTool('org-1');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('kb_search');
    });
  });

  describe('dispose', () => {
    it('should close the underlying database', () => {
      kbService = new KBService();
      expect(() => kbService.dispose()).not.toThrow();
    });
  });
});
