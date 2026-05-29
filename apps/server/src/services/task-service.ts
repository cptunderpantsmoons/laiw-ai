import { randomUUID } from 'node:crypto';

import { prisma } from '../models/prisma';

// ---------------------------------------------------------------------------
// TaskService — wraps Task model
// ---------------------------------------------------------------------------

export interface TaskServiceOptions {}

export interface CreateTaskInput {
  matterId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: Date;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status?: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assigneeId?: string;
  dueDate?: Date;
}

export interface TaskWithRelations {
  id: string;
  matterId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  assignee?: { id: string; email: string; firstName: string | null; lastName: string | null };
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  matter?: { id: string; name: string };
}

export class TaskService {
  constructor(opts: TaskServiceOptions = {}) {}

  /**
   * Create a new task.
   */
  async createTask(
    matterId: string,
    title: string,
    description?: string,
    assigneeId?: string,
    dueDate?: Date,
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    status?: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED',
  ): Promise<TaskWithRelations> {
    try {
      const task = await prisma.task.create({
        data: {
          id: randomUUID(),
          matterId,
          title,
          description: description || null,
          assigneeId: assigneeId || null,
          dueDate: dueDate || null,
          priority: priority || 'MEDIUM',
          status: status || 'PENDING',
        },
        include: {
          assignee: { select: { id: true, email: true, firstName: true, lastName: true } },
          matter: { select: { id: true, name: true } },
        },
      });
      return task as TaskWithRelations;
    } catch (err) {
      console.error('[TaskService] Failed to create task:', err);
      throw new Error(
        `Failed to create task: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Update an existing task's fields.
   */
  async updateTask(taskId: string, updates: UpdateTaskInput): Promise<TaskWithRelations> {
    try {
      const task = await prisma.task.update({
        where: { id: taskId },
        data: updates,
        include: {
          assignee: { select: { id: true, email: true, firstName: true, lastName: true } },
          matter: { select: { id: true, name: true } },
        },
      });
      return task as TaskWithRelations;
    } catch (err) {
      console.error('[TaskService] Failed to update task:', err);
      throw new Error(
        `Failed to update task: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * List tasks, optionally filtered by matterId, assigneeId, and/or status.
   */
  async listTasks(
    matterId?: string,
    assigneeId?: string,
    status?: string,
  ): Promise<TaskWithRelations[]> {
    try {
      const where: Record<string, unknown> = {};
      if (matterId) where.matterId = matterId;
      if (assigneeId) where.assigneeId = assigneeId;
      if (status) where.status = status;

      return prisma.task.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          assignee: { select: { id: true, email: true, firstName: true, lastName: true } },
          matter: { select: { id: true, name: true } },
        },
      }) as Promise<TaskWithRelations[]>;
    } catch (err) {
      console.error('[TaskService] Failed to list tasks:', err);
      return [];
    }
  }

  /**
   * Get a single task by id, or null if not found.
   */
  async getTask(taskId: string): Promise<TaskWithRelations | null> {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          assignee: { select: { id: true, email: true, firstName: true, lastName: true } },
          matter: { select: { id: true, name: true } },
        },
      });
      return task as TaskWithRelations | null;
    } catch (err) {
      console.error('[TaskService] Failed to get task:', err);
      return null;
    }
  }

  /**
   * Delete a task.
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      await prisma.task.delete({
        where: { id: taskId },
      });
    } catch (err) {
      console.error('[TaskService] Failed to delete task:', err);
      throw new Error(
        `Failed to delete task: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
