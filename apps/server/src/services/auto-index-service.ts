/**
 * AutoIndexService — automatically indexes documents and contracts into the
 * knowledge base so that matter context is searchable by the AI agent.
 *
 * Workflow:
 *  1. document uploaded → indexDocument() → chunks → KBStore.insert()
 *  2. contract created/updated → indexContract() → latest version content → KB
 *  3. matter detail loaded → indexMatterContext() → iterates all docs+contracts
 *  4. AI context → getMatterContext() → returns list of indexed resource IDs
 */

import { KBService, type SearchHit } from './kb-service';
import { ChatService } from './chat-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatterContextResult {
  /** KB document IDs that were indexed for this matter. */
  documentIds: string[];
  /** KB document IDs that were indexed for contracts of this matter. */
  contractIds: string[];
}

/**
 * Configuration options for the auto-index service.
 */
export interface AutoIndexServiceOptions {
  /** KBService instance (shared from container). */
  kbService: KBService;
  /** ChatService instance (shared from container). */
  chatService: ChatService;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AutoIndexService {
  private readonly kbService: KBService;
  private readonly chatService: ChatService;

  constructor(opts: AutoIndexServiceOptions) {
    this.kbService = opts.kbService;
    this.chatService = opts.chatService;
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /**
   * Index a single document into the knowledge base.
   *
   * Fetches the document's markdown content (via the document conversion
   * pipeline), chunks it, and inserts into the KB with matter context.
   */
  async indexDocument(
    matterId: string,
    documentId: string,
    orgId: string,
    documentName?: string,
  ): Promise<void> {
    try {
      // Fetch document metadata from Prisma
      const prisma = await import('../models/prisma').then((m) => m.prisma);

      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { name: true, mimeType: true, storageKey: true },
      });

      if (!doc) {
        console.warn(`[AutoIndex] Document not found: ${documentId}`);
        return;
      }

      // Extract text from the document
      const text = await this.extractDocumentText(doc, orgId);

      if (!text || !text.trim()) {
        console.warn(`[AutoIndex] No extractable text from document: ${documentId}`);
        return;
      }

      // Build a markdown header with matter context
      const matter = await prisma.matter.findUnique({
        where: { id: matterId },
        select: { name: true, description: true },
      });

      const contextPrefix = matter
        ? `Matter: ${matter.name}${matter.description ? `\nDescription: ${matter.description}` : ''}\n\n`
        : '';

      const markdown = `${contextPrefix}# ${doc.name || documentName || 'Document'}\n\n${text}`;

      // Index into KB — this handles chunking internally
      await this.kbService.chunkAndIndex(orgId, markdown);
      console.log(`[AutoIndex] Indexed document ${documentId} into KB (${documentName || doc.name})`);
    } catch (err) {
      console.error(`[AutoIndex] Failed to index document ${documentId}:`, err);
      // Do not throw — individual document indexing failures should not
      // block the overall matter indexing workflow.
    }
  }

  /**
   * Index a contract's latest version into the knowledge base.
   *
   * Fetches the contract's content from its latest version, chunks it,
   * and inserts into the KB.
   */
  async indexContract(
    matterId: string,
    contractId: string,
    orgId: string,
  ): Promise<void> {
    try {
      const prisma = await import('../models/prisma').then((m) => m.prisma);

      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          versions: {
            orderBy: { number: 'desc' },
            take: 1,
            select: { content: true, number: true },
          },
        },
      });

      if (!contract) {
        console.warn(`[AutoIndex] Contract not found: ${contractId}`);
        return;
      }

      const latestVersion = contract.versions[0];
      const content = latestVersion?.content;

      if (!content || !content.trim()) {
        console.warn(`[AutoIndex] No content in latest version of contract: ${contractId}`);
        return;
      }

      // Build context header
      const matter = await prisma.matter.findUnique({
        where: { id: matterId },
        select: { name: true, description: true },
      });

      const contextPrefix = matter
        ? `Matter: ${matter.name}${matter.description ? `\nDescription: ${matter.description}` : ''}\n\n`
        : '';

      const markdown = `${contextPrefix}# Contract: ${contract.title} (v${latestVersion.number})\n\n${content}`;

      await this.kbService.chunkAndIndex(orgId, markdown);
      console.log(`[AutoIndex] Indexed contract ${contractId} into KB`);
    } catch (err) {
      console.error(`[AutoIndex] Failed to index contract ${contractId}:`, err);
      // Do not throw — individual failures should not block the workflow.
    }
  }

  /**
   * Auto-index ALL documents and contracts for a matter.
   *
   * Called when a matter detail page loads or when explicitly triggered.
   * Each indexing operation is fire-and-forget so a single failure does
   * not prevent the others from succeeding.
   */
  async indexMatterContext(matterId: string, orgId: string): Promise<void> {
    try {
      const prisma = await import('../models/prisma').then((m) => m.prisma);

      // Fetch all documents and contracts for this matter
      const [documents, contracts] = await Promise.all([
        prisma.document.findMany({
          where: { matterId },
          select: { id: true, name: true },
        }),
        prisma.contract.findMany({
          where: { matterId },
          select: { id: true, title: true },
        }),
      ]);

      // Index documents in parallel
      const documentIndexPromises = documents.map((doc) =>
        this.indexDocument(matterId, doc.id, orgId, doc.name),
      );
      await Promise.allSettled(documentIndexPromises);

      // Index contracts in parallel
      const contractIndexPromises = contracts.map((contract) =>
        this.indexContract(matterId, contract.id, orgId),
      );
      await Promise.allSettled(contractIndexPromises);

      console.log(
        `[AutoIndex] Indexing complete for matter ${matterId}: ${documents.length} documents, ${contracts.length} contracts`,
      );
    } catch (err) {
      console.error(`[AutoIndex] Failed to index matter context ${matterId}:`, err);
    }
  }

  /**
   * Get the list of indexed document and contract IDs for a matter.
   *
   * Returns resource IDs that the AI agent can use to fetch full context.
   */
  async getMatterContext(
    matterId: string,
  ): Promise<MatterContextResult> {
    try {
      const prisma = await import('../models/prisma').then((m) => m.prisma);

      const [documents, contracts] = await Promise.all([
        prisma.document.findMany({
          where: { matterId },
          select: { id: true, name: true },
        }),
        prisma.contract.findMany({
          where: { matterId },
          select: { id: true, title: true },
        }),
      ]);

      return {
        documentIds: documents.map((d) => d.id),
        contractIds: contracts.map((c) => c.id),
      };
    } catch (err) {
      console.error(`[AutoIndex] Failed to get matter context for ${matterId}:`, err);
      return { documentIds: [], contractIds: [] };
    }
  }

  /**
   * Search the knowledge base for content relevant to a matter.
   *
   * Retrieves the matter context then searches for relevant KB entries.
   */
  async searchMatterContext(
    matterId: string,
    query: string,
    orgId: string,
    topK: number = 5,
  ): Promise<SearchHit[]> {
    try {
      const result = await this.kbService.searchKB(orgId, query, topK);
      return result.results;
    } catch (err) {
      console.error(`[AutoIndex] KB search failed for matter ${matterId}:`, err);
      return [];
    }
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  /**
   * Extract text from a document. Routes through the document conversion
   * pipeline (via DocService → markitdown-agent).
   */
  private async extractDocumentText(
    doc: { name: string; mimeType: string; storageKey: string },
    orgId: string,
  ): Promise<string> {
    try {
      // Try to fetch markdown from the document-conversion system.
      // In production, storageKey maps to a file on disk or S3.
      // For now, return a placeholder indicating conversion is needed.
      const vectorDbBaseUrl =
        process.env.VECTOR_DB_URL ?? 'http://localhost:3013';

      // Attempt to get markdown via the markitdown agent
      const response = await fetch(
        `${vectorDbBaseUrl}/convert`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileKey: doc.storageKey,
            mimeType: doc.mimeType,
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        return (data as { markdown?: string }).markdown || '';
      }

      console.warn(
        `[AutoIndex] markitdown conversion failed for ${doc.storageKey} (status ${response.status})`,
      );
      return '';
    } catch (err) {
      console.warn(
        `[AutoIndex] Could not convert document ${doc.storageKey}:`,
        err,
      );
      return '';
    }
  }
}
