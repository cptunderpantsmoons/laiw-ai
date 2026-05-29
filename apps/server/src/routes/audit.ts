import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import { getAuditService } from '../services/index.js'

const router: import('express').Router = Router()


// GET /api/audit/:matterId — List audit logs for matter
router.get('/audit/:matterId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { matterId } = req.params
    if (!matterId) return res.status(400).json({ error: 'matterId required' })
    const auditService = getAuditService()
    const logs = await auditService.listAuditLogs(matterId as string)
    res.json(logs)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
