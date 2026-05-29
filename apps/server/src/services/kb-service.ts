import { randomUUID } from 'node:crypto';

import {
  KnowledgeBaseStore,
  chunkMarkdown,
  createOpenAIEmbedder,
  createKbSearchTool,
  type Embedder,
  type KbDocument,
  type KbSearchHit,
  type KbInsertInput,
  type KbSearchToolDefinition,
  type KbSearchToolResult,
} from '@teamsuzie/kb';

import { openDb, type DatabaseInstance } from '@teamsuzie/db-sqlite';
import { KB_MIGRATIONS } from '@teamsuzie/kb';

// ---------------------------------------------------------------------------
// Embedder resolution — uses env config, falls back to local embedding
// ---------------------------------------------------------------------------

function createDefaultEmbedder(): Embedder {
  const baseUrl = process.env.OPENAI_EMBEDDING_BASE_URL ?? 'https://api.openai.com';
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const model = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
  const dim = parseInt(process.env.OPENAI_EMBEDDING_DIM ?? '1536', 10);

  return createOpenAIEmbedder({
    baseUrl,
    apiKey,
    model,
    dim,
    batchSize: 10,
    timeoutMs: 60_000,
  });
}

// ---------------------------------------------------------------------------
// KBService
// ---------------------------------------------------------------------------

export interface KBServiceOptions {
  store?: KnowledgeBaseStore;
  db?: DatabaseInstance;
  embedder?: Embedder;
}

export interface SearchHit {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  distance?: number;
}

export class KBService {
  private readonly store: KnowledgeBaseStore;
  private readonly db: DatabaseInstance;

  constructor(opts: KBServiceOptions = {}) {
    this.db = opts.db ?? openDb({
      path: process.env.AI_STORAGE_DB ?? ':memory:',
      migrations: KB_MIGRATIONS,
    });
    this.store = opts.store ?? new KnowledgeBaseStore({
      db: this.db,
      embedder: opts.embedder ?? createDefaultEmbedder(),
    });
  }

  /**
   * Insert a document into the knowledge base.
   * The content is expected to be markdown-formatted.
   */
  async insertDocument(
    orgId: string,
    content: string,
    title?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
  ): Promise<{ docId: string; chunks: number }> {
    try {
      const docName = title || 'Untitled document';
      const mimeType = 'text/markdown';
      const size = Buffer.byteLength(content, 'utf-8');

      const doc = await this.store.insert({
        name: docName,
        mimeType,
        size,
        markdown: content,
        ownerId: orgId,
      } as KbInsertInput);

      return { docId: doc.id, chunks: doc.chunkCount };
    } catch (err) {
      console.error('[KBService] Failed to insert document:', err);
      throw new Error(`Failed to insert document: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Search the knowledge base for a query, returning the top-K matching chunks.
   */
  async searchKB(
    orgId: string,
    query: string,
    topK: number = 5,
  ): Promise<{ results: SearchHit[]; query?: string }> {
    try {
      const hits = await this.store.search(query, { topK, ownerId: orgId });

      const results: SearchHit[] = hits.map((h) => ({
        documentId: h.document.id,
        documentName: h.document.name,
        chunkIndex: h.chunk.chunkIndex,
        content: h.chunk.content,
        distance: h.distance,
      }));

      return { results, query };
    } catch (err) {
      console.error('[KBService] Failed to search KB:', err);
      return { results: [] };
    }
  }

  /**
   * Chunk and index plain text by converting it to a markdown-like format
   * before indexing. Uses the kb package's chunkMarkdown for consistent
   * chunking.
   */
  async chunkAndIndex(orgId: string, text: string): Promise<number> {
    try {
      if (!text.trim()) return 0;

      const chunks = chunkMarkdown(text);
      if (chunks.length === 0) return 0;

      // Build a markdown document from the text
      const markdown = text.trim().startsWith('#') ? text.trim() : `# Document\n\n${text.trim()}`;
      const doc = await this.store.insert({
        name: 'Auto-indexed content',
        mimeType: 'text/markdown',
        size: Buffer.byteLength(markdown, 'utf-8'),
        markdown,
        ownerId: orgId,
      });

      return doc.chunkCount;
    } catch (err) {
      console.error('[KBService] Failed to chunk and index:', err);
      throw new Error(`Failed to chunk and index: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Create a kb_search tool definition for use with @teamsuzie/agent-loop.
   * The agent can call this tool during chat turns to look up relevant
   * knowledge base content.
   */
  createSearchTool(orgId: string): KbSearchToolDefinition {
    return createKbSearchTool({
      store: this.store,
      defaultTopK: 5,
      maxTopK: 20,
      getOwnerId: () => orgId,
    });
  }

  /** List all documents in the knowledge base for a given org. */
  listDocuments(orgId: string): KbDocument[] {
    try {
      return this.store.list(orgId);
    } catch (err) {
      console.error('[KBService] Failed to list documents:', err);
      return [];
    }
  }

  /** Delete a document from the knowledge base. */
  deleteDocument(docId: string): boolean {
    try {
      return this.store.delete(docId);
    } catch (err) {
      console.error('[KBService] Failed to delete document:', err);
      return false;
    }
  }

  /** Dispose of the underlying database connection. */
  dispose(): void {
    try {
      this.db.close();
    } catch {
      // Ignore close errors
    }
  }
}
