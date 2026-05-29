import {
  PersonaRegistry,
  PersonaStore,
  applyPersona,
  filterToolsForPersona,
  type Persona,
  type PersonaCreateInput,
  type PersonaSource,
  type ApplyPersonaResult,
  type ApplyPersonaInput,
} from '@teamsuzie/personas';

import {
  type AnyToolDefinition,
  type ToolDefinition,
} from '@teamsuzie/agent-loop';

import { openDb, type DatabaseInstance } from '@teamsuzie/db-sqlite';
import { PERSONAS_MIGRATIONS } from '@teamsuzie/personas';

// ---------------------------------------------------------------------------
// PersonaService
// ---------------------------------------------------------------------------

export interface PersonaServiceOptions {
  registry?: PersonaRegistry;
  db?: DatabaseInstance;
  builtinPersonasDir?: string;
}

export class PersonaService {
  private readonly registry: PersonaRegistry;
  private readonly db: DatabaseInstance;

  constructor(opts: PersonaServiceOptions = {}) {
    this.db = opts.db ?? openDb({
      path: process.env.AI_STORAGE_DB ?? ':memory:',
      migrations: PERSONAS_MIGRATIONS,
    });

    this.registry =
      opts.registry ??
      new PersonaRegistry({
        db: this.db,
        filesystemDir: opts.builtinPersonasDir,
      });
  }

  /**
   * Get a single persona by id, scoped to the given owner.
   */
  async getPersona(personaId: string): Promise<Persona | null> {
    try {
      const ownerId = process.env.AI_STORAGE_DB ?? 'default';
      return this.registry.get(personaId, ownerId);
    } catch (err) {
      console.error('[PersonaService] Failed to get persona:', err);
      return null;
    }
  }

  /**
   * List all personas visible to a given owner (builtins + user personas).
   */
  async listPersonas(): Promise<Persona[]> {
    try {
      const ownerId = process.env.AI_STORAGE_DB ?? 'default';
      return this.registry.listVisibleTo(ownerId);
    } catch (err) {
      console.error('[PersonaService] Failed to list personas:', err);
      return [];
    }
  }

  /**
   * List personas for a specific owner.
   */
  listPersonasForOwner(ownerId: string): Persona[] {
    try {
      return this.registry.listVisibleTo(ownerId);
    } catch (err) {
      console.error('[PersonaService] Failed to list owner personas:', err);
      return [];
    }
  }

  /**
   * Create a new user persona.
   */
  async createPersona(
    name: string,
    description: string,
    systemPrompt: string,
    tools?: string[],
  ): Promise<Persona> {
    try {
      const ownerId = process.env.AI_STORAGE_DB ?? 'default';
      const input: PersonaCreateInput = {
        ownerId,
        name,
        description,
        systemPrompt,
        allowedTools: tools && tools.length > 0 ? tools : undefined,
      };
      return this.registry.create(input);
    } catch (err) {
      console.error('[PersonaService] Failed to create persona:', err);
      throw new Error(
        `Failed to create persona: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Apply a persona to a set of tools and a prompt.
   * Returns the resolved system prompt, filtered tools, and optional model override.
   */
  async applyPersona(
    personaName: string,
    input: string,
    tools?: AnyToolDefinition[],
  ): Promise<ApplyPersonaResult<AnyToolDefinition>> {
    try {
      const ownerId = process.env.AI_STORAGE_DB ?? 'default';
      const persona = this.registry.get(personaName, ownerId);

      const toolSet = tools ?? [];

      return applyPersona<AnyToolDefinition>({
        defaultSystemPrompt: input,
        tools: toolSet,
        persona,
      });
    } catch (err) {
      console.error('[PersonaService] Failed to apply persona:', err);
      // Return default (unfiltered) result
      return {
        systemPrompt: input,
        tools: tools ?? [],
      };
    }
  }

  /**
   * Filter a set of tools based on a persona's allow/block list.
   */
  async filterToolsForPersona(
    personaName: string,
    tools?: AnyToolDefinition[],
  ): Promise<AnyToolDefinition[]> {
    try {
      const ownerId = process.env.AI_STORAGE_DB ?? 'default';
      const persona = this.registry.get(personaName, ownerId);
      const toolSet = tools ?? [];

      return filterToolsForPersona<AnyToolDefinition>(toolSet, persona);
    } catch (err) {
      console.error('[PersonaService] Failed to filter tools:', err);
      return tools ?? [];
    }
  }

  /**
   * Update a user persona.
   */
  async updatePersona(
    personaId: string,
    patch: {
      name?: string;
      description?: string;
      systemPrompt?: string;
      tools?: string[] | null;
    },
  ): Promise<Persona | null> {
    try {
      const ownerId = process.env.AI_STORAGE_DB ?? 'default';
      // PersonaRegistry.update expects PersonaUpdateInput
      const personaUpdateInput: Parameters<typeof this.registry.update>[2] = {};
      if (patch.name !== undefined) personaUpdateInput.name = patch.name;
      if (patch.description !== undefined) personaUpdateInput.description = patch.description;
      if (patch.systemPrompt !== undefined) personaUpdateInput.systemPrompt = patch.systemPrompt;
      if (patch.tools !== undefined) {
        personaUpdateInput.allowedTools = patch.tools;
      }
      return this.registry.update(personaId, ownerId, personaUpdateInput);
    } catch (err) {
      console.error('[PersonaService] Failed to update persona:', err);
      return null;
    }
  }

  /**
   * Delete a user persona.
   */
  async deletePersona(personaId: string): Promise<boolean> {
    try {
      const ownerId = process.env.AI_STORAGE_DB ?? 'default';
      return this.registry.delete(personaId, ownerId);
    } catch (err) {
      console.error('[PersonaService] Failed to delete persona:', err);
      return false;
    }
  }

  /**
   * Seed built-in personas for a user (one-shot copy from filesystem).
   */
  seedBuiltinsIfNeeded(ownerId: string): { seeded: boolean; count: number } {
    try {
      return this.registry.seedFromBuiltinsIfNeeded(ownerId);
    } catch (err) {
      console.error('[PersonaService] Failed to seed builtins:', err);
      return { seeded: false, count: 0 };
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
