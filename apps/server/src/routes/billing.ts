import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import { getBillingService } from '../services/index.js'

const router: import('express').Router = Router()


// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

// POST /api/billing/invoices — Create invoice
router.post('/billing/invoices', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { matterId, amount, dateIssued, invoiceNumber } = req.body
    if (!matterId || amount === undefined) return res.status(400).json({ error: 'matterId and amount required' })
    const billingService = getBillingService()
    const result = await billingService.createInvoice(
      matterId,
      req.userId!,
      amount,
      dateIssued ? new Date(dateIssued) : new Date(),
      invoiceNumber,
    )
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/billing/invoices — List invoices
router.get('/billing/invoices', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const billingService = getBillingService()
    const invoices = await billingService.listInvoices(
      req.query.matterId as string | undefined,
      req.query.userId as string | undefined,
    )
    res.json(invoices)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/billing/invoices/:invoiceId — Get invoice detail
router.get('/billing/invoices/:invoiceId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const billingService = getBillingService()
    const invoices = await billingService.listInvoices(undefined, req.userId!)
    const invoice = invoices.find((inv: { id: string }) => inv.id === req.params.invoiceId)
    if (!invoice) return res.status(404).json({ error: 'invoice not found' })
    res.json(invoice)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// PATCH /api/billing/invoices/:invoiceId/paid — Mark as paid
router.patch('/billing/invoices/:invoiceId/paid', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const billingService = getBillingService()
    await billingService.markInvoicePaid(req.params.invoiceId as string)
    res.json({ success: true, invoiceId: req.params.invoiceId })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/billing/invoices/:invoiceId/approve — Approve invoice
router.post('/billing/invoices/:invoiceId/approve', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { supervisorId } = req.body
    if (!supervisorId) return res.status(400).json({ error: 'supervisorId required' })
    const billingService = getBillingService()
    await billingService.approveInvoice(req.params.invoiceId as string, supervisorId)
    res.status(201).json({ success: true, invoiceId: req.params.invoiceId })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// Time Entries
// ---------------------------------------------------------------------------

// POST /api/billing/time-entries — Create time entry
router.post('/billing/time-entries', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { matterId, startTime, endTime, description } = req.body
    if (!matterId || !startTime) return res.status(400).json({ error: 'matterId and startTime required' })
    const billingService = getBillingService()
    const result = await billingService.createTimeEntry(
      matterId,
      req.userId!,
      new Date(startTime),
      endTime ? new Date(endTime) : undefined,
      description,
    )
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/billing/time-entries — List time entries
router.get('/billing/time-entries', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const billingService = getBillingService()
    const entries = await billingService.listTimeEntries(
      req.query.matterId as string | undefined,
      req.query.userId as string | undefined,
    )
    res.json(entries)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/billing/time-entries/:timeEntryId/bill — Auto-bill time entry
router.post('/billing/time-entries/:timeEntryId/bill', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const billingService = getBillingService()
    const result = await billingService.autoBillTimeEntry(req.params.timeEntryId as string)
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
