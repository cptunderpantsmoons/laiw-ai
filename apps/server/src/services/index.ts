/**
 * ServiceContainer — lazy-initialized singleton for all Phase 2 AI services.
 *
 * Each service is constructed once and reused across requests. This avoids
 * the overhead of creating new database connections and stores on every
 * request. Services are initialized on first access (lazy) and disposed
 * on shutdown.
 */

import { openDb, type DatabaseInstance } from '@teamsuzie/db-sqlite';
import { CHATS_MIGRATIONS } from '@teamsuzie/chats';
import { KB_MIGRATIONS } from '@teamsuzie/kb';
import { PERSONAS_MIGRATIONS } from '@teamsuzie/personas';
import { REVIEWS_MIGRATIONS } from '@teamsuzie/reviews';
import { WORKFLOWS_MIGRATIONS } from '@teamsuzie/workflows';
import { DOCUMENT_VERSIONS_MIGRATIONS } from '@teamsuzie/document-versions';

import { ChatService } from './chat-service';
import type { ChatServiceOptions } from './chat-service';

import { KBService } from './kb-service';
import type { KBServiceOptions } from './kb-service';

import { ReviewService } from './review-service';
import type { ReviewServiceOptions } from './review-service';

import { PersonaService } from './persona-service';
import type { PersonaServiceOptions } from './persona-service';

import { WorkflowService } from './workflow-service';
import type { WorkflowServiceOptions } from './workflow-service';

import { DocService } from './doc-service';
import type { DocServiceOptions } from './doc-service';

import { BillingService } from './billing-service';
import type { BillingServiceOptions } from './billing-service';

import { ContactService } from './contact-service';
import type { ContactServiceOptions } from './contact-service';

import { AuditService } from './audit-service';
import type { AuditServiceOptions } from './audit-service';

import { MatterTypeService } from './matter-type-service';
import type { MatterTypeServiceOptions } from './matter-type-service';

import { TaskService } from './task-service';
import type { TaskServiceOptions } from './task-service';

import { CustomFieldService } from './custom-field-service';
import type { CustomFieldServiceOptions } from './custom-field-service';

import { AiIntakeService } from './ai-intake-service';

import { AutoIndexService } from './auto-index-service';
import type { AutoIndexServiceOptions } from './auto-index-service';

import { MatterAutoService } from './matter-auto-service';
import type { MatterAutoServiceOptions } from './matter-auto-service';

// ---------------------------------------------------------------------------
// Shared SQLite instance (one process, one shared DB)
// ---------------------------------------------------------------------------

const STORAGE_DB_PATH = process.env.AI_STORAGE_DB ?? ':memory:';

function createSharedDb(): DatabaseInstance {
  return openDb({
    path: STORAGE_DB_PATH,
    migrations: [
      ...CHATS_MIGRATIONS,
      ...KB_MIGRATIONS,
      ...PERSONAS_MIGRATIONS,
      ...REVIEWS_MIGRATIONS,
      ...WORKFLOWS_MIGRATIONS,
      ...DOCUMENT_VERSIONS_MIGRATIONS,
    ],
  });
}

// ---------------------------------------------------------------------------
// Container state (module-level singleton)
// ---------------------------------------------------------------------------

interface ServiceContainerState {
  initialized: boolean;
  db: DatabaseInstance | null;
  chatService: ChatService | null;
  kbService: KBService | null;
  reviewService: ReviewService | null;
  personaService: PersonaService | null;
  workflowService: WorkflowService | null;
  docService: DocService | null;
  billingService: BillingService | null;
  contactService: ContactService | null;
  auditService: AuditService | null;
  matterTypeService: MatterTypeService | null;
  taskService: TaskService | null;
  customFieldService: CustomFieldService | null;
  aiIntakeService: AiIntakeService | null;
  autoIndexService: AutoIndexService | null;
  matterAutoService: MatterAutoService | null;
  disposers: (() => void)[];
}

const state: ServiceContainerState = {
  initialized: false,
  db: null,
  chatService: null,
  kbService: null,
  reviewService: null,
  personaService: null,
  workflowService: null,
  docService: null,
  billingService: null,
  contactService: null,
  auditService: null,
  matterTypeService: null,
  taskService: null,
  customFieldService: null,
  aiIntakeService: null,
  autoIndexService: null,
  matterAutoService: null,
  disposers: [],
};

// ---------------------------------------------------------------------------
// Service factory options (merged from env)
// ---------------------------------------------------------------------------

function resolveDb(): DatabaseInstance {
  if (!state.db) {
    state.db = createSharedDb();
  }
  return state.db;
}

function resolveChatOptions(): ChatServiceOptions {
  return {
    db: resolveDb(),
  };
}

function resolveKbOptions(): KBServiceOptions {
  return {
    db: resolveDb(),
  };
}

function resolveReviewOptions(): ReviewServiceOptions {
  return {
    db: resolveDb(),
  };
}

function resolvePersonaOptions(): PersonaServiceOptions {
  return {
    db: resolveDb(),
  };
}

function resolveWorkflowOptions(): WorkflowServiceOptions {
  return {
    db: resolveDb(),
  };
}

function resolveDocOptions(): DocServiceOptions {
  return {
    db: resolveDb(),
    markitdownAgentBaseUrl:
      process.env.MARKITDOWN_AGENT_BASE_URL ??
      'http://localhost:3013',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the container. This runs the shared migrations across all
 * service schemas. Idempotent — safe to call multiple times.
 */
function initialize(): void {
  if (state.initialized) return;

  try {
    resolveDb();
    state.initialized = true;
    console.log('[ServiceContainer] All service databases initialized.');
  } catch (err) {
    console.error('[ServiceContainer] Failed to initialize services:', err);
  }
}

/**
 * Access the ChatService singleton. Initializes the container if needed.
 */
function getChatService(): ChatService {
  if (!state.chatService) {
    initialize();
    state.chatService = new ChatService(resolveChatOptions());
    state.disposers.push(() => {
      try { state.chatService?.dispose(); } catch { /* no-op */ }
      state.chatService = null;
    });
  }
  return state.chatService;
}

/**
 * Access the KBService singleton. Initializes the container if needed.
 */
function getKBService(): KBService {
  if (!state.kbService) {
    initialize();
    state.kbService = new KBService(resolveKbOptions());
    state.disposers.push(() => {
      try { state.kbService?.dispose(); } catch { /* no-op */ }
      state.kbService = null;
    });
  }
  return state.kbService;
}

/**
 * Access the ReviewService singleton. Initializes the container if needed.
 */
function getReviewService(): ReviewService {
  if (!state.reviewService) {
    initialize();
    state.reviewService = new ReviewService(resolveReviewOptions());
    state.disposers.push(() => {
      try { state.reviewService?.dispose(); } catch { /* no-op */ }
      state.reviewService = null;
    });
  }
  return state.reviewService;
}

/**
 * Access the PersonaService singleton. Initializes the container if needed.
 */
function getPersonaService(): PersonaService {
  if (!state.personaService) {
    initialize();
    state.personaService = new PersonaService(resolvePersonaOptions());
    state.disposers.push(() => {
      try { state.personaService?.dispose(); } catch { /* no-op */ }
      state.personaService = null;
    });
  }
  return state.personaService;
}

/**
 * Access the WorkflowService singleton. Initializes the container if needed.
 */
function getWorkflowService(): WorkflowService {
  if (!state.workflowService) {
    initialize();
    state.workflowService = new WorkflowService(resolveWorkflowOptions());
    state.disposers.push(() => {
      try { state.workflowService?.dispose(); } catch { /* no-op */ }
      state.workflowService = null;
    });
  }
  return state.workflowService;
}

/**
 * Access the DocService singleton. Initializes the container if needed.
 */
function getDocService(): DocService {
  if (!state.docService) {
    initialize();
    state.docService = new DocService(resolveDocOptions());
    state.disposers.push(() => {
      try { state.docService?.dispose(); } catch { /* no-op */ }
      state.docService = null;
    });
  }
  return state.docService;
}

/**
 * Access the BillingService singleton. Initializes the container if needed.
 */
function getBillingService(): BillingService {
  if (!state.billingService) {
    initialize();
    state.billingService = new BillingService({});
    state.disposers.push(() => {
      state.billingService = null;
    });
  }
  return state.billingService;
}

/**
 * Access the ContactService singleton. Initializes the container if needed.
 */
function getContactService(): ContactService {
  if (!state.contactService) {
    initialize();
    state.contactService = new ContactService({});
    state.disposers.push(() => {
      state.contactService = null;
    });
  }
  return state.contactService;
}

/**
 * Access the AuditService singleton. Initializes the container if needed.
 */
function getAuditService(): AuditService {
  if (!state.auditService) {
    initialize();
    state.auditService = new AuditService({});
    state.disposers.push(() => {
      state.auditService = null;
    });
  }
  return state.auditService;
}

/**
 * Access the MatterTypeService singleton. Initializes the container if needed.
 */
function getMatterTypeService(): MatterTypeService {
  if (!state.matterTypeService) {
    initialize();
    state.matterTypeService = new MatterTypeService({});
    state.disposers.push(() => {
      state.matterTypeService = null;
    });
  }
  return state.matterTypeService;
}

/**
 * Access the TaskService singleton. Initializes the container if needed.
 */
function getTaskService(): TaskService {
  if (!state.taskService) {
    initialize();
    state.taskService = new TaskService({});
    state.disposers.push(() => {
      state.taskService = null;
    });
  }
  return state.taskService;
}

/**
 * Access the CustomFieldService singleton. Initializes the container if needed.
 */
function getCustomFieldService(): CustomFieldService {
  if (!state.customFieldService) {
    initialize();
    state.customFieldService = new CustomFieldService({});
    state.disposers.push(() => {
      state.customFieldService = null;
    });
  }
  return state.customFieldService;
}

/**
 * Access the AiIntakeService singleton. Initializes the container if needed.
 */
function getAiIntakeService(): AiIntakeService {
  if (!state.aiIntakeService) {
    initialize();
    const chatSvc = getChatService();
    state.aiIntakeService = new AiIntakeService(chatSvc);
    state.disposers.push(() => {
      state.aiIntakeService = null;
    });
  }
  return state.aiIntakeService;
}

/**
 * Access the AutoIndexService singleton. Initializes the container if needed.
 *
 * Auto-indexes documents and contracts into the knowledge base so they
 * are searchable by the AI agent.
 */
function getAutoIndexService(): AutoIndexService {
  if (!state.autoIndexService) {
    initialize();
    const kbSvc = getKBService();
    const chatSvc = getChatService();
    state.autoIndexService = new AutoIndexService({ kbService: kbSvc, chatService: chatSvc });
    state.disposers.push(() => {
      state.autoIndexService = null;
    });
  }
  return state.autoIndexService;
}

/**
 * Access the MatterAutoService singleton. Initializes the container if needed.
 *
 * Auto-creates matters from intake submissions using AI triage results.
 */
function getMatterAutoService(): MatterAutoService {
  if (!state.matterAutoService) {
    initialize();
    const aiIntakeSvc = getAiIntakeService();
    state.matterAutoService = new MatterAutoService({ aiIntakeService: aiIntakeSvc });
    state.disposers.push(() => {
      state.matterAutoService = null;
    });
  }
  return state.matterAutoService;
}

/**
 * Dispose all services and close the shared database.
 * Call this on server shutdown.
 */
function disposeAll(): void {
  const disposers = [...state.disposers];
  state.disposers = [];

  for (const dispose of disposers) {
    try { dispose(); } catch { /* no-op */ }
  }

  if (state.db) {
    try { state.db.close(); } catch { /* no-op */ }
    state.db = null;
  }

  state.initialized = false;
  console.log('[ServiceContainer] All services disposed.');
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export {
  getChatService,
  getKBService,
  getReviewService,
  getPersonaService,
  getWorkflowService,
  getDocService,
  getBillingService,
  getContactService,
  getAuditService,
  getMatterTypeService,
  getTaskService,
  getCustomFieldService,
  getAiIntakeService,
  getAutoIndexService,
  getMatterAutoService,
  disposeAll,
};

// Also export individual types for import by consumers
export { ChatService } from './chat-service';
export { KBService } from './kb-service';
export { ReviewService } from './review-service';
export { PersonaService } from './persona-service';
export { WorkflowService } from './workflow-service';
export { DocService } from './doc-service';
export { BillingService } from './billing-service';
export { ContactService } from './contact-service';
export { AuditService } from './audit-service';
export { MatterTypeService } from './matter-type-service';
export { TaskService } from './task-service';
export { CustomFieldService } from './custom-field-service';
export { AiIntakeService } from './ai-intake-service';
export { AutoIndexService } from './auto-index-service';
export { MatterAutoService } from './matter-auto-service';
