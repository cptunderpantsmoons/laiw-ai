import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import {
  getKBService,
} from '../services/index.js'

const router: Router = Router()


// ── AI Knowledge Base Routes ────────────────────────────

// POST /api/ai/kb/documents — Insert a document into the knowledge base
router.post('/ai/kb/documents', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, content, title, tags, metadata } = req.body
    if (!orgId) return res.status(400).json({ error: 'orgId required' })
    if (!content) return res.status(400).json({ error: 'content required' })

    const kbService = getKBService()
    const result = await kbService.insertDocument(orgId as string, content, title, tags, metadata)
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/ai/kb/search — Search the knowledge base
router.get('/ai/kb/search', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.query.orgId as string
    const query = req.query.query as string
    const topK = parseInt((req.query.topK as string) || '5', 10)
    if (!orgId) return res.status(400).json({ error: 'orgId query param required' })
    if (!query) return res.status(400).json({ error: 'query query param required' })

    const kbService = getKBService()
    const result = await kbService.searchKB(orgId, query, topK)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/ai/kb/chunk — Chunk and index plain text
router.post('/ai/kb/chunk', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, text } = req.body
    if (!orgId) return res.status(400).json({ error: 'orgId required' })
    if (!text) return res.status(400).json({ error: 'text required' })

    const kbService = getKBService()
    const chunkCount = await kbService.chunkAndIndex(orgId as string, text)
    res.status(201).json({ chunkCount })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
