import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import { getCustomFieldService } from '../services/index.js'

const router: import('express').Router = Router()


// POST /api/custom-fields — Create custom field
router.post('/custom-fields', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, name, type, options, required } = req.body
    if (!orgId) return res.status(400).json({ error: 'orgId required' })
    if (!name) return res.status(400).json({ error: 'name required' })
    if (!type) return res.status(400).json({ error: 'type required' })
    const customFieldService = getCustomFieldService()
    const field = await customFieldService.createField(
      orgId,
      name,
      type,
      options,
      required || false,
    )
    res.status(201).json(field)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/custom-fields — List custom fields
router.get('/custom-fields', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.query.orgId as string | undefined
    if (!orgId) return res.status(400).json({ error: 'orgId required' })
    const customFieldService = getCustomFieldService()
    const fields = await customFieldService.listFields(orgId)
    res.json(fields)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/custom-fields/:fieldId — Get custom field
router.get('/custom-fields/:fieldId', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const customFieldService = getCustomFieldService()
    const field = await customFieldService.getField(_req.params.fieldId as string)
    if (!field) return res.status(404).json({ error: 'custom field not found' })
    res.json(field)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// PATCH /api/custom-fields/:fieldId — Update custom field
router.patch('/custom-fields/:fieldId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, options, required } = req.body
    const customFieldService = getCustomFieldService()
    const field = await customFieldService.updateField(req.params.fieldId as string, {
      name,
      type,
      options,
      required,
    })
    res.json(field)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// DELETE /api/custom-fields/:fieldId — Delete custom field
router.delete('/custom-fields/:fieldId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const customFieldService = getCustomFieldService()
    await customFieldService.deleteField(req.params.fieldId as string)
    res.json({ success: true, fieldId: req.params.fieldId })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
