import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

// Use vi.hoisted to avoid vi.mock hoisting issues
const mocked = vi.hoisted(() => ({
  billingInvoiceCreate: vi.fn(),
  billingInvoiceFindUnique: vi.fn(),
  billingInvoiceFindMany: vi.fn(),
  billingInvoiceUpdate: vi.fn(),
  invoiceApprovalCreate: vi.fn(),
  timeEntryCreate: vi.fn(),
  timeEntryFindUnique: vi.fn(),
  timeEntryFindMany: vi.fn(),
  timeEntryUpdate: vi.fn(),
  spendBudgetFindMany: vi.fn(),
  spendBudgetUpdate: vi.fn(),
  retainerUsageCreate: vi.fn(),
  retainerUsageFindMany: vi.fn(),
}));

vi.mock('../models/prisma', () => ({
  prisma: {
    billingInvoice: {
      create: mocked.billingInvoiceCreate,
      findUnique: mocked.billingInvoiceFindUnique,
      findMany: mocked.billingInvoiceFindMany,
      update: mocked.billingInvoiceUpdate,
    },
    invoiceApproval: { create: mocked.invoiceApprovalCreate },
    timeEntry: {
      create: mocked.timeEntryCreate,
      findUnique: mocked.timeEntryFindUnique,
      findMany: mocked.timeEntryFindMany,
      update: mocked.timeEntryUpdate,
    },
    spendBudget: {
      findMany: mocked.spendBudgetFindMany,
      update: mocked.spendBudgetUpdate,
    },
    retainerUsage: {
      create: mocked.retainerUsageCreate,
      findMany: mocked.retainerUsageFindMany,
    },
  },
}));

import { BillingService } from './billing-service';

describe('BillingService', () => {
  let billingService: BillingService;

  beforeEach(() => {
    vi.clearAllMocks();
    billingService = new BillingService();

    // Set default return values
    mocked.billingInvoiceCreate.mockResolvedValue({
      id: 'invoice-1', matterId: 'matter-1', userId: 'user-1',
      invoiceNumber: 'INV-12345678', dateIssued: new Date('2025-01-01'),
      amount: new Decimal(500), isPaid: false,
    });
    mocked.billingInvoiceFindUnique.mockResolvedValue({ id: 'invoice-1', isPaid: false });
    mocked.billingInvoiceFindMany.mockResolvedValue([{ id: 'invoice-1', matterId: 'matter-1', isPaid: false }]);
    mocked.billingInvoiceUpdate.mockResolvedValue({ id: 'invoice-1', isPaid: true });
    mocked.invoiceApprovalCreate.mockResolvedValue({ id: 'approval-1', invoiceId: 'invoice-1', isApproved: true, approvedAt: new Date() });
    mocked.timeEntryCreate.mockResolvedValue({
      id: 'te-1', matterId: 'matter-1', userId: 'user-1',
      startTime: new Date('2025-01-01T09:00:00'),
      endTime: new Date('2025-01-01T11:00:00'),
      description: 'Client meeting', isBilled: false,
    });
    mocked.timeEntryFindUnique.mockResolvedValue({
      id: 'te-1', matterId: 'matter-1', userId: 'user-1',
      startTime: new Date('2025-01-01T09:00:00'),
      endTime: new Date('2025-01-01T11:00:00'),
      description: 'Client meeting', isBilled: false,
      matter: { id: 'matter-1', name: 'Test Matter' },
      user: { id: 'user-1', email: 'user@test.com' },
    });
    mocked.timeEntryFindMany.mockResolvedValue([{ id: 'te-1', matterId: 'matter-1' }]);
    mocked.timeEntryUpdate.mockResolvedValue({ id: 'te-1', isBilled: true });
    mocked.spendBudgetFindMany.mockResolvedValue([{
      id: 'budget-1', matterId: 'matter-1',
      totalAmount: new Decimal(5000), spent: new Decimal(500),
      currency: 'USD', createdAt: new Date(),
    }]);
    mocked.spendBudgetUpdate.mockResolvedValue({ id: 'budget-1' });
    mocked.retainerUsageCreate.mockResolvedValue({
      id: 'usage-1', budgetId: 'budget-1', amount: new Decimal(150),
      date: new Date(), timeEntryId: 'te-1', description: 'Client meeting',
    });
    mocked.retainerUsageFindMany.mockResolvedValue([{ id: 'usage-1', budget: { matterId: 'matter-1' } }]);
  });

  describe('createInvoice', () => {
    it('should create an invoice with auto-generated invoice number', async () => {
      const result = await billingService.createInvoice('matter-1', 'user-1', 500, new Date('2025-01-01'));

      expect(result.invoiceId).toBe('invoice-1');
      expect(mocked.billingInvoiceCreate).toHaveBeenCalled();
    });

    it('should create an invoice with a custom invoice number', async () => {
      await billingService.createInvoice('matter-1', 'user-1', 500, new Date('2025-01-01'), 'INV-CUSTOM-001');

      expect(mocked.billingInvoiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ invoiceNumber: 'INV-CUSTOM-001' }),
        }),
      );
    });

    it('should throw on create failure', async () => {
      mocked.billingInvoiceCreate.mockRejectedValue(new Error('DB error'));

      await expect(billingService.createInvoice('matter-1', 'user-1', 500, new Date()))
        .rejects.toThrow('Failed to create invoice');
    });
  });

  describe('approveInvoice', () => {
    it('should approve an invoice and create approval record', async () => {
      await billingService.approveInvoice('invoice-1', 'supervisor-1');

      expect(mocked.billingInvoiceFindUnique).toHaveBeenCalledWith({
        where: { id: 'invoice-1' }, select: { isPaid: true },
      });
      expect(mocked.invoiceApprovalCreate).toHaveBeenCalledWith({
        data: { invoiceId: 'invoice-1', supervisorId: 'supervisor-1', isApproved: true, approvedAt: expect.any(Date) },
      });
    });

    it('should throw when invoice not found', async () => {
      mocked.billingInvoiceFindUnique.mockResolvedValue(null);

      await expect(billingService.approveInvoice('nonexistent', 'supervisor-1'))
        .rejects.toThrow('Invoice not found');
    });

    it('should throw when invoice is already paid', async () => {
      mocked.billingInvoiceFindUnique.mockResolvedValue({ isPaid: true });

      await expect(billingService.approveInvoice('invoice-1', 'supervisor-1'))
        .rejects.toThrow('already paid');
    });
  });

  describe('markInvoicePaid', () => {
    it('should mark an invoice as paid', async () => {
      await billingService.markInvoicePaid('invoice-1');

      expect(mocked.billingInvoiceUpdate).toHaveBeenCalledWith({
        where: { id: 'invoice-1' }, data: { isPaid: true },
      });
    });

    it('should throw on mark paid failure', async () => {
      mocked.billingInvoiceUpdate.mockRejectedValue(new Error('DB error'));

      await expect(billingService.markInvoicePaid('invoice-1'))
        .rejects.toThrow('Failed to mark invoice as paid');
    });
  });

  describe('createTimeEntry', () => {
    it('should create a time entry', async () => {
      const result = await billingService.createTimeEntry('matter-1', 'user-1', new Date('2025-01-01T09:00:00'), new Date('2025-01-01T11:00:00'), 'Client meeting');

      expect(result.timeEntryId).toBe('te-1');
    });

    it('should create a time entry without endTime', async () => {
      const startTime = new Date('2025-01-01T09:00:00');
      await billingService.createTimeEntry('matter-1', 'user-1', startTime);

      expect(mocked.timeEntryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ endTime: null }),
        }),
      );
    });

    it('should throw on time entry creation failure', async () => {
      mocked.timeEntryCreate.mockRejectedValue(new Error('DB error'));

      await expect(billingService.createTimeEntry('matter-1', 'user-1', new Date()))
        .rejects.toThrow('Failed to create time entry');
    });
  });

  describe('listInvoices', () => {
    it('should list invoices with optional filters', async () => {
      const result = await billingService.listInvoices('matter-1', 'user-1');

      expect(result).toEqual([{ id: 'invoice-1', matterId: 'matter-1', isPaid: false }]);
    });

    it('should list all invoices when no filters provided', async () => {
      await billingService.listInvoices();

      expect(mocked.billingInvoiceFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { dateIssued: 'desc' },
        include: {
          matter: { select: { id: true, name: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          approvals: true,
        },
      });
    });

    it('should return empty array on error', async () => {
      mocked.billingInvoiceFindMany.mockRejectedValue(new Error('DB error'));

      const result = await billingService.listInvoices();
      expect(result).toEqual([]);
    });
  });

  describe('listTimeEntries', () => {
    it('should list time entries with optional filters', async () => {
      const result = await billingService.listTimeEntries('matter-1', 'user-1');

      expect(result).toEqual([{ id: 'te-1', matterId: 'matter-1' }]);
    });

    it('should return empty array on error', async () => {
      mocked.timeEntryFindMany.mockRejectedValue(new Error('DB error'));

      const result = await billingService.listTimeEntries();
      expect(result).toEqual([]);
    });
  });

  describe('autoBillTimeEntry', () => {
    it('should auto-bill against a retainer with remaining balance', async () => {
      const result = await billingService.autoBillTimeEntry('te-1');

      expect(result).toEqual({ retainerUsageId: 'usage-1' });
      expect(mocked.retainerUsageCreate).toHaveBeenCalled();
    });

    it('should create an invoice when no retainer has balance', async () => {
      mocked.spendBudgetFindMany.mockResolvedValue([]);
      mocked.billingInvoiceCreate.mockResolvedValue({
        id: 'inv-auto', matterId: 'matter-1', userId: 'user-1',
        invoiceNumber: 'INV-AUTO', dateIssued: new Date(),
        amount: new Decimal(300), isPaid: false,
      });

      const result = await billingService.autoBillTimeEntry('te-1');

      expect(result.invoiceId).toBe('inv-auto');
      expect(mocked.billingInvoiceCreate).toHaveBeenCalled();
    });

    it('should throw when time entry not found', async () => {
      mocked.timeEntryFindUnique.mockResolvedValue(null);

      await expect(billingService.autoBillTimeEntry('nonexistent'))
        .rejects.toThrow('Time entry not found');
    });

    it('should throw when time entry has invalid duration (no endTime)', async () => {
      mocked.timeEntryFindUnique.mockResolvedValue({
        id: 'te-1', matterId: 'matter-1', userId: 'user-1',
        startTime: new Date('2025-01-01T11:00:00'),
        endTime: null,
        description: 'Client meeting', isBilled: false,
        matter: { id: 'matter-1', name: 'Test Matter' },
        user: { id: 'user-1', email: 'user@test.com' },
      });

      await expect(billingService.autoBillTimeEntry('te-1'))
        .rejects.toThrow('no valid duration');
    });
  });

  describe('getRetainerUsage', () => {
    it('should list retainer usages for a budget', async () => {
      const result = await billingService.getRetainerUsage('budget-1');

      expect(result).toEqual([{ id: 'usage-1', budget: { matterId: 'matter-1' } }]);
    });

    it('should return empty array on error', async () => {
      mocked.retainerUsageFindMany.mockRejectedValue(new Error('DB error'));

      const result = await billingService.getRetainerUsage('budget-1');
      expect(result).toEqual([]);
    });
  });
});
