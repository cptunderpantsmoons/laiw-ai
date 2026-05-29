import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import { createMatter, listMatters, getMatter, updateMatter, archiveMatter, createTask, listTasks } from '../models/matter'
import { createOrganization } from '../models/user'

const router = Router()


// ── Matters ───────────────────────────────────────────────

// GET /api/matters
router.get('/matters', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Find user's org first
    const user = await (await import('../models/prisma')).prisma.user.findUnique({
      where: { id: req.userId! },
      select: { organizationId: true },
    })
    if (!user?.organizationId) return res.status(400).json({ error: 'no organization' })
    const matters = await listMatters(user.organizationId, req.userId!, req.query.status as string)
    res.json(matters)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/matters
router.post('/matters', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await (await import('../models/prisma')).prisma.user.findUnique({
      where: { id: req.userId! },
      select: { organizationId: true },
    })
    if (!user?.organizationId) return res.status(400).json({ error: 'no organization' })
    const { name, description } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const matter = await createMatter(name, description || null, user.organizationId, req.userId!)
    res.status(201).json(matter)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/matters/:id
router.get('/matters/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const matter = await getMatter(req.params.id as string, req.userId!)
    if (!matter) return res.status(404).json({ error: 'matter not found' })
    res.json(matter)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// PATCH /api/matters/:id
router.patch('/matters/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const matter = await updateMatter(req.params.id as string, name, description || null)
    res.json(matter)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/matters/:id/archive
router.post('/matters/:id/archive', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const matter = await archiveMatter(_req.params.id as string)
    res.json(matter)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ── Tasks ─────────────────────────────────────────────────

// GET /api/matters/:matterId/tasks
router.get('/matters/:matterId/tasks', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tasks = await listTasks(req.params.matterId as string, req.query.status ? req.query.status as string : undefined)
    res.json(tasks)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/matters/:matterId/tasks
router.post('/matters/:matterId/tasks', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, priority, assigneeId } = req.body
    if (!title) return res.status(400).json({ error: 'title required' })
    const task = await createTask(req.params.matterId as string, title, description || null, priority || 'MEDIUM', assigneeId || null)
    res.status(201).json(task)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
