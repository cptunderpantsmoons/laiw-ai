import { randomUUID } from 'node:crypto';
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '../models/prisma';

// ---------------------------------------------------------------------------
// BillingService — wraps Invoice, InvoiceApproval, RetainerUsage, TimeEntry
// ---------------------------------------------------------------------------

export interface BillingServiceOptions {}

export interface CreateInvoiceResult {
  invoiceId: string;
}

export interface CreateTimeEntryResult {
  timeEntryId: string;
}

export interface AutoBillResult {
  retainerUsageId?: string;
  invoiceId?: string;
}

export class BillingService {
  constructor(opts: BillingServiceOptions = {}) {
    // No mutable state needed — all operations go through Prisma.
  }

  /**
   * Create a new billing invoice for a matter.
   */
  async createInvoice(
    matterId: string,
    userId: string,
    amount: number,
    dateIssued: Date,
    invoiceNumber?: string,
  ): Promise<CreateInvoiceResult> {
    try {
      const invoice = await prisma.billingInvoice.create({
        data: {
          matterId,
          userId,
          invoiceNumber: invoiceNumber ?? `INV-${randomUUID().slice(0, 8).toUpperCase()}`,
          dateIssued,
          amount: new Decimal(amount),
          isPaid: false,
        },
      });
      return { invoiceId: invoice.id };
    } catch (err) {
      console.error('[BillingService] Failed to create invoice:', err);
      throw new Error(
        `Failed to create invoice: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Approve (or reject) an invoice on behalf of a supervisor.
   * Creates an InvoiceApproval record and flips isApproved to true.
   */
  async approveInvoice(invoiceId: string, supervisorId: string): Promise<void> {
    try {
      const invoice = await prisma.billingInvoice.findUnique({
        where: { id: invoiceId },
        select: { isPaid: true },
      });

      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      if (invoice.isPaid) {
        throw new Error(`Invoice ${invoiceId} is already paid.`);
      }

      // Create the approval record
      await prisma.invoiceApproval.create({
        data: {
          invoiceId,
          supervisorId,
          isApproved: true,
          approvedAt: new Date(),
        },
      });
    } catch (err) {
      console.error('[BillingService] Failed to approve invoice:', err);
      throw new Error(
        `Failed to approve invoice: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * List invoices, optionally filtered by matterId and/or userId.
   */
  async listInvoices(matterId?: string, userId?: string): Promise<any[]> {
    try {
      const where: Record<string, unknown> = {};
      if (matterId) where.matterId = matterId;
      if (userId) where.userId = userId;

      return prisma.billingInvoice.findMany({
        where,
        orderBy: { dateIssued: 'desc' },
        include: {
          matter: { select: { id: true, name: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          approvals: true,
        },
      });
    } catch (err) {
      console.error('[BillingService] Failed to list invoices:', err);
      return [];
    }
  }

  /**
   * Mark an invoice as paid and set the approval date.
   */
  async markInvoicePaid(invoiceId: string): Promise<void> {
    try {
      await prisma.billingInvoice.update({
        where: { id: invoiceId },
        data: { isPaid: true },
      });
    } catch (err) {
      console.error('[BillingService] Failed to mark invoice as paid:', err);
      throw new Error(
        `Failed to mark invoice as paid: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Create a time entry for a user on a matter.
   */
  async createTimeEntry(
    matterId: string,
    userId: string,
    startTime: Date,
    endTime?: Date,
    description?: string,
  ): Promise<CreateTimeEntryResult> {
    try {
      const entry = await prisma.timeEntry.create({
        data: {
          matterId,
          userId,
          startTime,
          endTime: endTime || null,
          description: description || null,
          isBilled: false,
        },
      });
      return { timeEntryId: entry.id };
    } catch (err) {
      console.error('[BillingService] Failed to create time entry:', err);
      throw new Error(
        `Failed to create time entry: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * List time entries, optionally filtered by matterId and/or userId.
   */
  async listTimeEntries(matterId?: string, userId?: string): Promise<any[]> {
    try {
      const where: Record<string, unknown> = {};
      if (matterId) where.matterId = matterId;
      if (userId) where.userId = userId;

      return prisma.timeEntry.findMany({
        where,
        orderBy: { startTime: 'desc' },
        include: {
          matter: { select: { id: true, name: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });
    } catch (err) {
      console.error('[BillingService] Failed to list time entries:', err);
      return [];
    }
  }

  /**
   * Auto-bill a time entry:
   *  1. Look for any active SpendBudget (retainer) for the matter.
   *  2. If the retainer has remaining balance, deduct from it (create RetainerUsage).
   *  3. If no retainer, create an Invoice for the time entry amount.
   */
  async autoBillTimeEntry(timeEntryId: string): Promise<AutoBillResult> {
    try {
      const entry = await prisma.timeEntry.findUnique({
        where: { id: timeEntryId },
        include: { matter: true, user: true },
      });

      if (!entry) {
        throw new Error(`Time entry not found: ${timeEntryId}`);
      }

      // Calculate duration in hours (assuming hourly rate — use $150 as default billable rate if no rate stored)
      const durationHours = entry.endTime
        ? (entry.endTime.getTime() - entry.startTime.getTime()) / (1000 * 60 * 60)
        : 0;

      if (durationHours <= 0) {
        throw new Error('Time entry has no valid duration (startTime >= endTime).');
      }

      const billableAmount = 150 * durationHours; // default rate: $150/hr

      // Look for an active retainer budget on this matter
      const budgets = await prisma.spendBudget.findMany({
        where: { matterId: entry.matterId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, totalAmount: true, spent: true },
      });

      const totalAmt = budgets[0]?.totalAmount?.toNumber() ?? 0;
      const spentAmt = budgets[0]?.spent?.toNumber() ?? 0;
      let remaining = totalAmt - spentAmt;

      // If we found a retainer with enough balance, deduct from it
      if (remaining > 0) {
        const usage = await prisma.retainerUsage.create({
          data: {
            budgetId: budgets[0].id,
            amount: new Decimal(billableAmount),
            date: new Date(),
            description: entry.description ?? `Auto-bill: ${entry.user.email} on ${entry.matter.name}`,
            timeEntry: { connect: { id: entry.id } },
          },
        });

        // Update the budget's spent total
        await prisma.spendBudget.update({
          where: { id: budgets[0].id },
          data: { spent: budgets[0].spent.add(new Decimal(billableAmount)) },
        });

        // Mark the time entry as billed and link the retainer usage
        await prisma.timeEntry.update({
          where: { id: entry.id },
          data: { isBilled: true, retainerUsageId: usage.id },
        });

        return { retainerUsageId: usage.id };
      }

      // No retainer — create an invoice instead
      const invoice = await prisma.billingInvoice.create({
        data: {
          matterId: entry.matterId,
          userId: entry.userId,
          invoiceNumber: `INV-${randomUUID().slice(0, 8).toUpperCase()}`,
          dateIssued: new Date(),
          amount: new Decimal(billableAmount),
          isPaid: false,
        },
      });

      // Mark the time entry as billed
      await prisma.timeEntry.update({
        where: { id: entry.id },
        data: { isBilled: true },
      });

      return { invoiceId: invoice.id };
    } catch (err) {
      console.error('[BillingService] Failed to auto-bill time entry:', err);
      throw new Error(
        `Failed to auto-bill: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * List retainer usages for a given budget.
   */
  async getRetainerUsage(budgetId: string): Promise<any[]> {
    try {
      return prisma.retainerUsage.findMany({
        where: { budgetId },
        orderBy: { date: 'desc' },
        include: {
          budget: { select: { id: true, matterId: true, totalAmount: true, spent: true } },
          timeEntry: { select: { id: true, startTime: true, endTime: true, description: true, user: { select: { email: true } } } },
        },
      });
    } catch (err) {
      console.error('[BillingService] Failed to get retainer usage:', err);
      return [];
    }
  }
}
