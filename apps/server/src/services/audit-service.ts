import { prisma } from '../models/prisma';

// ---------------------------------------------------------------------------
// AuditService — wraps AuditLog model
// ---------------------------------------------------------------------------

export interface AuditServiceOptions {}

export interface AuditEntry {
  id: string;
  matterId: string;
  userId: string;
  content: string;
  createdAt: Date;
}

export class AuditService {
  constructor(opts: AuditServiceOptions = {}) {
    // No mutable state needed — all operations go through Prisma.
  }

  /**
   * Log an activity for a matter by a user.
   */
  async logActivity(matterId: string, userId: string, content: string): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          matterId,
          userId,
          content,
        },
      });
    } catch (err) {
      console.error('[AuditService] Failed to log activity:', err);
      throw new Error(
        `Failed to log activity: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * List all audit logs for a matter, newest first.
   */
  async listAuditLogs(matterId: string): Promise<AuditEntry[]> {
    try {
      return prisma.auditLog.findMany({
        where: { matterId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      console.error('[AuditService] Failed to list audit logs:', err);
      return [];
    }
  }

  /**
   * Convenience method: create a matter-creation audit log entry.
   * Logs that a user created a matter.
   */
  async createMatterCreationLog(matterId: string, userId: string): Promise<void> {
    const content = `Matter created`;
    await this.logActivity(matterId, userId, content);
  }
}
