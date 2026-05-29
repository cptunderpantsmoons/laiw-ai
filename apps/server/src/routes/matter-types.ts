import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import { getMatterTypeService } from '../services/index.js'

const router: import('express').Router = Router()


// POST /api/matter-types — Create type
router.post('/matter-types', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description } = req.body
    if (!title) return res.status(400).json({ error: 'title required' })
    const matterTypeService = getMatterTypeService()
    const result = await matterTypeService.createType(title, description)
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/matter-types — List all types
router.get('/matter-types', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const matterTypeService = getMatterTypeService()
    const types = await matterTypeService.listTypes()
    res.json(types)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/matter-types/:typeId — Get type
router.get('/matter-types/:typeId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const matterTypeService = getMatterTypeService()
    const typeObj = await matterTypeService.getType(req.params.typeId as string)
    if (!typeObj) return res.status(404).json({ error: 'matter type not found' })
    res.json(typeObj)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// PATCH /api/matter-types/:typeId — Update type
router.patch('/matter-types/:typeId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description } = req.body
    if (!title && !description) return res.status(400).json({ error: 'title or description required' })
    const matterTypeService = getMatterTypeService()
    await matterTypeService.updateType(req.params.typeId as string, { title, description })
    const updated = await matterTypeService.getType(req.params.typeId as string)
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// DELETE /api/matter-types/:typeId — Delete type
router.delete('/matter-types/:typeId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const matterTypeService = getMatterTypeService()
    await matterTypeService.deleteType(req.params.typeId as string)
    res.json({ success: true, typeId: req.params.typeId })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
