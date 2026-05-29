import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import {
  getPersonaService,
} from '../services/index.js'
import type { Persona } from '@teamsuzie/personas'

const router: Router = Router()


// ── AI Persona Routes ───────────────────────────────────

// GET /api/ai/personas — List all personas
router.get('/ai/personas', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const personaService = getPersonaService()
    const personas = await personaService.listPersonas()
    res.json(personas)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/ai/personas/:personaId — Get a single persona
router.get('/ai/personas/:personaId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const personaId = req.params.personaId as string
    const personaService = getPersonaService()
    const persona = await personaService.getPersona(personaId)

    if (!persona) return res.status(404).json({ error: 'persona not found' })

    res.json(persona)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/ai/personas — Create a new persona
router.post('/ai/personas', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, systemPrompt, tools } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    if (!description) return res.status(400).json({ error: 'description required' })
    if (!systemPrompt) return res.status(400).json({ error: 'systemPrompt required' })

    const personaService = getPersonaService()
    const persona = await personaService.createPersona(name, description, systemPrompt, tools)
    res.status(201).json(persona)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/ai/personas/:personaId/apply — Apply a persona to input
router.post('/ai/personas/:personaId/apply', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const personaId = req.params.personaId as string
    const { input, tools } = req.body
    if (!input) return res.status(400).json({ error: 'input required' })

    const personaService = getPersonaService()
    const result = await personaService.applyPersona(personaId, input, tools as any)
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
