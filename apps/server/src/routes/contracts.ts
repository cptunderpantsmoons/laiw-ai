import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import {
  createContract, listContracts, getContract, updateContract,
  createVersion, listVersions, createRedline, listRedlines,
} from '../models/contract'

const router = Router()


// ── Contracts ─────────────────────────────────────────────

// GET /api/contracts
router.get('/contracts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { matterId, status } = req.query
    if (!matterId) return res.status(400).json({ error: 'matterId required' })
    const contracts = await listContracts(matterId as string, status as string | undefined)
    res.json(contracts)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/contracts
router.post('/contracts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { matterId, title, counterparty, contractType, startDate, endDate } = req.body
    if (!matterId || !title) return res.status(400).json({ error: 'matterId and title required' })
    const contract = await createContract(matterId, title, counterparty || null, contractType || null, startDate || null, endDate || null)
    res.status(201).json(contract)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/contracts/:id
router.get('/contracts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const contract = await getContract(req.params.id as string)
    if (!contract) return res.status(404).json({ error: 'contract not found' })
    res.json(contract)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// PATCH /api/contracts/:id
router.patch('/contracts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const contract = await updateContract(req.params.id as string, req.body)
    if (!contract) return res.status(404).json({ error: 'contract not found' })
    res.json(contract)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/contracts/:id/versions
router.post('/contracts/:id/versions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { number, content, docxKey, changes } = req.body
    if (number === undefined) return res.status(400).json({ error: 'version number required' })
    const version = await createVersion(req.params.id as string, number, content || null, docxKey || null, changes || null)
    res.status(201).json(version)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/contracts/:contractId/versions
router.get('/contracts/:contractId/versions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const versions = await listVersions(req.params.contractId as string)
    res.json(versions)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/contracts/:contractId/redlines
router.get('/contracts/:contractId/redlines', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { versionId } = req.query
    if (!versionId) return res.status(400).json({ error: 'versionId required' })
    const redlines = await listRedlines(versionId as string)
    res.json(redlines)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
