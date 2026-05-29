import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import {
  getWorkflowService,
} from '../services/index.js'
import type { WorkflowStep } from '../services/workflow-service'
import type { Workflow, WorkflowOutputMode } from '@teamsuzie/workflows'

const router: Router = Router()


// ── AI Workflow Routes ──────────────────────────────────

// POST /api/ai/workflows — Create a new workflow
router.post('/ai/workflows', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, steps, context } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    if (!steps || !Array.isArray(steps)) return res.status(400).json({ error: 'steps required (array)' })

    // Validate each step has the required fields
    for (const step of steps) {
      if (!step.name || !step.prompt) {
        return res.status(400).json({ error: 'each step must have name and prompt' })
      }
    }

    const workflowService = getWorkflowService()
    const typedSteps: WorkflowStep[] = steps.map(
      (s: Record<string, unknown>) => ({
        id: (s.id as string) || '',
        name: s.name as string,
        prompt: s.prompt as string,
        outputMode: s.outputMode as WorkflowOutputMode | undefined,
        columnConfig: s.columnConfig as any,
        practiceAreas: s.practiceAreas as string[],
      }),
    )
    const result = await workflowService.createWorkflow(name, typedSteps, context)
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/ai/workflows/:workflowId/run — Run a workflow
router.post('/ai/workflows/:workflowId/run', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const workflowId = req.params.workflowId as string

    const workflowService = getWorkflowService()
    const result = await workflowService.runWorkflow(workflowId)
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/ai/workflows — List workflows for an org
router.get('/ai/workflows', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = (req.query.orgId as string) || undefined
    const includeArchived = req.query.includeArchived === 'true'

    const workflowService = getWorkflowService()
    const workflows = await workflowService.listWorkflows({
      orgId,
      includeArchived,
    })
    res.json(workflows)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
