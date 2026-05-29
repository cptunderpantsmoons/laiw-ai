import { randomUUID } from 'node:crypto';

import {
  WorkflowsStore,
  type Workflow,
  type WorkflowSource,
  type WorkflowOutputMode,
  type WorkflowColumnConfig,
  type CreateUserWorkflowInput,
} from '@teamsuzie/workflows';

import { openDb, type DatabaseInstance } from '@teamsuzie/db-sqlite';
import { WORKFLOWS_MIGRATIONS } from '@teamsuzie/workflows';

// ---------------------------------------------------------------------------
// Workflow types for the service layer
// ---------------------------------------------------------------------------

export interface WorkflowStep {
  id: string;
  name: string;
  prompt: string;
  outputMode?: WorkflowOutputMode;
  columnConfig?: WorkflowColumnConfig[];
  practiceAreas?: string[];
}

export interface WorkflowServiceResult {
  workflowId: string;
}

export interface WorkflowListOptions {
  orgId?: string;
  includeArchived?: boolean;
}

// ---------------------------------------------------------------------------
// WorkflowService
// ---------------------------------------------------------------------------

export interface WorkflowServiceOptions {
  store?: WorkflowsStore;
  db?: DatabaseInstance;
}

export class WorkflowService {
  private readonly store: WorkflowsStore;
  private readonly db: DatabaseInstance;

  constructor(opts: WorkflowServiceOptions = {}) {
    this.db = opts.db ?? openDb({
      path: process.env.AI_STORAGE_DB ?? ':memory:',
      migrations: WORKFLOWS_MIGRATIONS,
    });
    this.store = opts.store ?? new WorkflowsStore({
      db: this.db,
      idFactory: randomUUID,
    });
  }

  /**
   * Create a workflow from a series of steps.
   * The steps are combined into a single prompt for the workflow.
   */
  async createWorkflow(
    name: string,
    steps: WorkflowStep[],
    context?: Record<string, unknown>,
  ): Promise<WorkflowServiceResult> {
    try {
      const ownerId = context?.ownerId ?? process.env.AI_STORAGE_DB ?? 'default';

      // Build a combined prompt from the steps
      const combinedPrompt = steps
        .map((step) => `${step.name}:\n${step.prompt}`)
        .join('\n\n---\n\n');

      const outputMode =
        steps[0]?.outputMode ?? 'inline_chat';

      const columnConfig =
        steps.length === 1 && steps[0]?.columnConfig
          ? steps[0].columnConfig
          : null;

      const practiceAreas = Array.from(
        new Set(steps.flatMap((s) => s.practiceAreas ?? [])),
      );

      const input: CreateUserWorkflowInput = {
        ownerId: ownerId as string,
        name,
        description: context?.description as string ?? 'Automated workflow',
        prompt: combinedPrompt,
        practiceAreas: practiceAreas.length > 0 ? practiceAreas : undefined,
        columnConfig,
        outputMode,
      };

      const workflow = this.store.createUserWorkflow(input);
      return { workflowId: workflow.id };
    } catch (err) {
      console.error('[WorkflowService] Failed to create workflow:', err);
      throw new Error(
        `Failed to create workflow: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Run a workflow. This resolves the workflow's prompt and optionally
   * integrates it with the agent loop for execution.
   */
  async runWorkflow(workflowId: string): Promise<{ status: string; result?: unknown }> {
    try {
      const workflow = this.store.get(workflowId);
      if (!workflow) {
        return {
          status: 'error',
          result: `Workflow not found: ${workflowId}`,
        };
      }

      // In the @teamsuzie/workflows model, workflows are prompt definitions.
      // "Running" a workflow means resolving its prompt for execution.
      // The actual agent loop execution would happen at the route layer.

      return {
        status: 'ready',
        result: {
          name: workflow.name,
          prompt: workflow.prompt,
          outputMode: workflow.outputMode,
          columnConfig: workflow.columnConfig,
        },
      };
    } catch (err) {
      console.error('[WorkflowService] Failed to run workflow:', err);
      return {
        status: 'error',
        result: `Failed to run workflow: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * List workflows, optionally filtered by org/owner.
   */
  async listWorkflows(opts?: WorkflowListOptions): Promise<Workflow[]> {
    try {
      const ownerId = opts?.orgId ?? process.env.AI_STORAGE_DB ?? 'default';
      return this.store.listVisible({
        ownerId: ownerId as string,
        includeArchived: opts?.includeArchived ?? false,
      });
    } catch (err) {
      console.error('[WorkflowService] Failed to list workflows:', err);
      return [];
    }
  }

  /**
   * Get a single workflow by id.
   */
  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    try {
      return this.store.get(workflowId);
    } catch (err) {
      console.error('[WorkflowService] Failed to get workflow:', err);
      return null;
    }
  }

  /**
   * Archive a workflow.
   */
  async archiveWorkflow(workflowId: string, ownerId: string): Promise<boolean> {
    try {
      return this.store.archive(workflowId, ownerId);
    } catch (err) {
      console.error('[WorkflowService] Failed to archive workflow:', err);
      return false;
    }
  }

  /**
   * Unarchive a workflow.
   */
  async unarchiveWorkflow(workflowId: string, ownerId: string): Promise<boolean> {
    try {
      return this.store.unarchive(workflowId, ownerId);
    } catch (err) {
      console.error('[WorkflowService] Failed to unarchive workflow:', err);
      return false;
    }
  }

  /**
   * Get version history for a workflow.
   */
  async getWorkflowVersions(workflowId: string, ownerId: string) {
    try {
      return this.store.listVersions(workflowId, ownerId);
    } catch (err) {
      console.error('[WorkflowService] Failed to list versions:', err);
      return [];
    }
  }

  /**
   * Restore a workflow to a previous version.
   */
  async restoreWorkflowVersion(
    workflowId: string,
    versionId: string,
    ownerId: string,
    capturedBy?: string | null,
  ) {
    try {
      return this.store.restoreVersion(workflowId, versionId, ownerId, capturedBy);
    } catch (err) {
      console.error('[WorkflowService] Failed to restore version:', err);
      return null;
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
