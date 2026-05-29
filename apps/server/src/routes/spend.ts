import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import {
  createBudget, listBudgets, updateBudget,
  createTransaction, listTransactions, updateTransactionStatus, getMatterSpendSummary,
} from '../models/spend'

const router = Router()


// ── Budgets ───────────────────────────────────────────────

// GET /api/spend/budgets
router.get('/spend/budgets', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { matterId } = req.query
    const budgets = await listBudgets(matterId as string | undefined)
    res.json(budgets)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/spend/budgets
router.post('/spend/budgets', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { matterId, totalAmount, currency } = req.body
    if (!matterId || totalAmount === undefined) return res.status(400).json({ error: 'matterId and totalAmount required' })
    const budget = await createBudget(matterId, totalAmount, currency || 'USD')
    res.status(201).json(budget)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// PATCH /api/spend/budgets/:id
router.patch('/spend/budgets/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const budget = await updateBudget(req.params.id as string, req.body)
    if (!budget) return res.status(404).json({ error: 'budget not found' })
    res.json(budget)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ── Transactions ──────────────────────────────────────────

// GET /api/spend/transactions
router.get('/spend/transactions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { matterId, status } = req.query
    const transactions = await listTransactions(matterId as string | undefined, status as string | undefined)
    res.json(transactions)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/spend/transactions
router.post('/spend/transactions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { matterId, type, amount, vendorName, invoiceRef, notes } = req.body
    if (!matterId || type === undefined || amount === undefined) {
      return res.status(400).json({ error: 'matterId, type, and amount required' })
    }
    const transaction = await createTransaction(matterId, type, amount, vendorName || null, invoiceRef || null, notes || null)
    res.status(201).json(transaction)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// PATCH /api/spend/transactions/:id/status
router.patch('/spend/transactions/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body
    if (!status) return res.status(400).json({ error: 'status required' })
    const transaction = await updateTransactionStatus(req.params.id as string, status)
    if (!transaction) return res.status(404).json({ error: 'transaction not found' })
    res.json(transaction)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/spend/summary/:matterId
router.get('/spend/summary/:matterId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const summary = await getMatterSpendSummary(req.params.matterId as string)
    res.json(summary)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
