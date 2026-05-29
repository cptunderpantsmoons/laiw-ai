import { openDb, type DatabaseInstance } from '@teamsuzie/db-sqlite';
import { DOCUMENT_VERSIONS_MIGRATIONS } from '@teamsuzie/document-versions';

import { DocumentVersionsStore } from '@teamsuzie/document-versions';
import type { DocumentVersion, VersionSource } from '@teamsuzie/document-versions';

import {
  convertToMarkdown,
  exportMarkdownToDocx,
  type ConvertResult,
} from '@teamsuzie/document-conversion';

// ---------------------------------------------------------------------------
// DocService
// ---------------------------------------------------------------------------

export interface DocServiceOptions {
  store?: DocumentVersionsStore;
  db?: DatabaseInstance;
  /** Base URL for the markitdown-agent service. */
  markitdownAgentBaseUrl?: string;
}

export class DocService {
  private readonly store: DocumentVersionsStore;
  private readonly db: DatabaseInstance;
  private readonly markitdownAgentBaseUrl: string;

  constructor(opts: DocServiceOptions = {}) {
    this.db = opts.db ?? openDb({
      path: process.env.AI_STORAGE_DB ?? ':memory:',
      migrations: DOCUMENT_VERSIONS_MIGRATIONS,
    });
    this.store = opts.store ?? new DocumentVersionsStore({
      db: this.db,
    });
    this.markitdownAgentBaseUrl =
      opts.markitdownAgentBaseUrl ??
      process.env.MARKITDOWN_AGENT_BASE_URL ??
      'http://localhost:3013';
  }

  /**
   * Convert an uploaded document file buffer to markdown.
   * DOCX files are handled in-process via mammoth; other types route
   * to the markitdown-agent service.
   */
  async convertDocument(
    fileBuffer: Buffer,
    mimeType: string,
    matterId: string,
    fileName?: string,
  ): Promise<{ markdown: string; metadata: Record<string, unknown> }> {
    try {
      const result = await convertToMarkdown(fileBuffer, {
        mime: mimeType,
        filename: fileName ?? 'document',
        markitdownAgentBaseUrl: this.markitdownAgentBaseUrl,
      });

      // Store the markdown as a new document version
      const storageId = `doc_${matterId}_${Date.now()}`;
      const version = this.store.addVersion({
        externalDocId: matterId,
        source: 'upload',
        storageId,
        byteSize: fileBuffer.length,
        notes: fileName,
      });

      return {
        markdown: result.markdown,
        metadata: {
          backend: result.backend,
          versionId: version.id,
          warnings: result.warnings ?? [],
          storageId: version.storageId,
          notes: version.notes,
          contentHash: version.contentHash,
        },
      };
    } catch (err) {
      console.error('[DocService] Failed to convert document:', err);
      throw new Error(
        `Failed to convert document: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Create a new version of a document's content.
   * The previousVersionId becomes the parent for the chain.
   */
  async createVersion(
    content: string,
    previousVersionId?: string,
    versionSource: VersionSource = 'proposal',
    notes?: string,
  ): Promise<{ versionId: string; number: number }> {
    try {
      // Compute storageId from the content (e.g., hash or in-memory ref)
      const storageId = `content_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const byteSize = Buffer.byteLength(content, 'utf-8');

      // Find the externalDocId from the previous version or generate one
      let externalDocId: string;
      let parentId: string | null = null;

      if (previousVersionId) {
        const prevVersion = this.store.getVersion(previousVersionId);
        if (!prevVersion) {
          throw new Error(`Previous version not found: ${previousVersionId}`);
        }
        externalDocId = prevVersion.externalDocId;
        parentId = previousVersionId;
      } else {
        // Generate a new doc id
        externalDocId = `doc_${Date.now()}`;
      }

      const version = this.store.addVersion({
        externalDocId,
        parentId,
        source: versionSource,
        storageId,
        byteSize,
        notes: notes ?? null,
      });

      // Count version number in the chain
      const chain = this.store.walkAncestors(version.id);
      const versionNumber = chain.length;

      return { versionId: version.id, number: versionNumber };
    } catch (err) {
      console.error('[DocService] Failed to create version:', err);
      throw new Error(
        `Failed to create version: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Generate a DOCX file from markdown content.
   * Routes through the markitdown-agent /export/docx endpoint.
   */
  async generateDocx(
    versionId: string,
    content: string,
    filename?: string,
  ): Promise<{ docxBuffer: Buffer }> {
    try {
      const docxBytes = await exportMarkdownToDocx({
        markdown: content,
        filename: filename ?? 'document',
        markitdownAgentBaseUrl: this.markitdownAgentBaseUrl,
      });

      // Store the generated docx as a new version
      const storageId = `gen_${versionId}_${Date.now()}`;
      this.store.addVersion({
        externalDocId: this.store.getVersion(versionId)?.externalDocId ?? `doc_${Date.now()}`,
        parentId: versionId,
        source: 'generated',
        storageId,
        byteSize: docxBytes.length,
        notes: `Generated DOCX from v${versionId.slice(0, 8)}`,
      });

      return { docxBuffer: Buffer.from(docxBytes) };
    } catch (err) {
      console.error('[DocService] Failed to generate DOCX:', err);
      throw new Error(
        `Failed to generate DOCX: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Get a document version by id. */
  getVersion(versionId: string): DocumentVersion | null {
    try {
      return this.store.getVersion(versionId);
    } catch (err) {
      console.error('[DocService] Failed to get version:', err);
      return null;
    }
  }

  /** List all versions for a logical document. */
  listVersions(externalDocId: string): DocumentVersion[] {
    try {
      return this.store.listVersions(externalDocId);
    } catch (err) {
      console.error('[DocService] Failed to list versions:', err);
      return [];
    }
  }

  /** Get the current head version for a logical document. */
  getHead(externalDocId: string): DocumentVersion | null {
    try {
      return this.store.getHead(externalDocId);
    } catch (err) {
      console.error('[DocService] Failed to get head:', err);
      return null;
    }
  }

  /**
   * Walk the ancestor chain from a version (itself, parent, grandparent, etc.).
   */
  walkAncestors(versionId: string): DocumentVersion[] {
    try {
      return this.store.walkAncestors(versionId);
    } catch (err) {
      console.error('[DocService] Failed to walk ancestors:', err);
      return [];
    }
  }

  /**
   * Walk the descendants of a version (all versions derived from it).
   */
  walkDescendants(versionId: string): DocumentVersion[] {
    try {
      return this.store.walkDescendants(versionId);
    } catch (err) {
      console.error('[DocService] Failed to walk descendants:', err);
      return [];
    }
  }

  /** Restore the head pointer to a specific version. */
  restoreVersion(externalDocId: string, versionId: string): DocumentVersion {
    try {
      return this.store.setHead(externalDocId, versionId);
    } catch (err) {
      console.error('[DocService] Failed to restore version:', err);
      throw new Error(
        `Failed to restore version: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Delete all versions for a logical document. */
  deleteDocument(externalDocId: string): number {
    try {
      return this.store.deleteAllForDocument(externalDocId);
    } catch (err) {
      console.error('[DocService] Failed to delete document:', err);
      return 0;
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
