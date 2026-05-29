import { randomUUID } from 'node:crypto';

import { prisma } from '../models/prisma';

// ---------------------------------------------------------------------------
// MatterTypeService — wraps MatterType model
// ---------------------------------------------------------------------------

export interface MatterTypeServiceOptions {}

export interface CreateTypeInput {
  title: string;
  description?: string;
}

export interface UpdateTypeInput {
  title?: string;
  description?: string;
}

export class MatterTypeService {
  constructor(opts: MatterTypeServiceOptions = {}) {
    // No mutable state needed — all operations go through Prisma.
  }

  /**
   * Create a new matter type.
   */
  async createType(title: string, description?: string): Promise<{ typeId: string }> {
    try {
      const matterType = await prisma.matterType.create({
        data: {
          title,
          description: description || null,
        },
      });
      return { typeId: matterType.id };
    } catch (err) {
      console.error('[MatterTypeService] Failed to create matter type:', err);
      throw new Error(
        `Failed to create matter type: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * List all matter types, newest first.
   */
  async listTypes(): Promise<any[]> {
    try {
      return prisma.matterType.findMany({
        orderBy: { id: 'asc' },
        include: {
          cases: { select: { id: true, name: true, status: true } },
        },
      });
    } catch (err) {
      console.error('[MatterTypeService] Failed to list matter types:', err);
      return [];
    }
  }

  /**
   * Get a single matter type by id, or null if not found.
   */
  async getType(typeId: string): Promise<any | null> {
    try {
      return prisma.matterType.findUnique({
        where: { id: typeId },
        include: {
          cases: { select: { id: true, name: true, status: true } },
        },
      });
    } catch (err) {
      console.error('[MatterTypeService] Failed to get matter type:', err);
      return null;
    }
  }

  /**
   * Update a matter type.
   */
  async updateType(typeId: string, updates: UpdateTypeInput): Promise<void> {
    try {
      await prisma.matterType.update({
        where: { id: typeId },
        data: updates,
      });
    } catch (err) {
      console.error('[MatterTypeService] Failed to update matter type:', err);
      throw new Error(
        `Failed to update matter type: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Delete a matter type. If there are associated matters, the relation
   * is nullable so matters will simply lose their type reference.
   */
  async deleteType(typeId: string): Promise<void> {
    try {
      await prisma.matterType.delete({
        where: { id: typeId },
      });
    } catch (err) {
      console.error('[MatterTypeService] Failed to delete matter type:', err);
      throw new Error(
        `Failed to delete matter type: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
