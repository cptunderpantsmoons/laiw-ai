import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import { createEntry, listEntries, getEntry, updateEntry, deleteEntry } from '../models/kb'
import { prisma } from '../models/prisma'

const router = Router()


async function getOrgId(req: AuthRequest): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { organizationId: true },
  })
  return user?.organizationId || null
}

// ── KB Entries ────────────────────────────────────────────

// GET /api/kb/entries
router.get('/kb/entries', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return res.status(400).json({ error: 'no organization' })
    const { search, tags } = req.query
    const entries = await listEntries(orgId, search as string | undefined, typeof tags === 'string' ? tags.split(',') : undefined)
    res.json(entries)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/kb/entries
router.post('/kb/entries', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return res.status(400).json({ error: 'no organization' })
    const { title, body, tags } = req.body
    if (!title || !body) return res.status(400).json({ error: 'title and body required' })
    const entry = await createEntry(orgId, title, body, tags || [])
    res.status(201).json(entry)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/kb/entries/:id
router.get('/kb/entries/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const entry = await getEntry(req.params.id as string)
    if (!entry) return res.status(404).json({ error: 'entry not found' })
    res.json(entry)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// PATCH /api/kb/entries/:id
router.patch('/kb/entries/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const entry = await updateEntry(req.params.id as string, req.body)
    if (!entry) return res.status(404).json({ error: 'entry not found' })
    res.json(entry)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// DELETE /api/kb/entries/:id
router.delete('/kb/entries/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await deleteEntry(req.params.id as string)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
