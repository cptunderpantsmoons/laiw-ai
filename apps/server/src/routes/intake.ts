import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import {
  createForm,
  listForms,
  submitForm,
  submitFormWithTriage,
  updateSubmissionTriage,
  listSubmissions,
  getSubmission,
  updateSubmissionStatus,
} from '../models/intake'
import { getAiIntakeService, getMatterTypeService } from '../services'

const router = Router()


// ── Public: Form Submission ───────────────────────────────

// POST /api/intake/:formId/submit — Public (no auth required)
router.post('/:formId/submit', async (req: Request, res: Response) => {
  try {
    const { submitter, answers } = req.body

    if (!submitter) return res.status(400).json({ error: 'submitter required' })
    if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'answers required' })

    const submission = await submitForm(req.params.formId as string, submitter, answers)
    res.status(201).json({ submissionId: submission.id, status: submission.status })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ── Admin: Intake Forms ───────────────────────────────────

// POST /api/intake/forms — Create intake form
router.post('/forms', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, formSchema } = req.body

    if (!name) return res.status(400).json({ error: 'name required' })

    const user = await (await import('../models/prisma')).prisma.user.findUnique({
      where: { id: req.userId! },
      select: { organizationId: true },
    })
    if (!user?.organizationId) return res.status(400).json({ error: 'no organization' })

    const form = await createForm(user.organizationId, name, formSchema || null)
    res.status(201).json(form)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/intake/forms — List all intake forms
router.get('/forms', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await (await import('../models/prisma')).prisma.user.findUnique({
      where: { id: req.userId! },
      select: { organizationId: true },
    })
    if (!user?.organizationId) return res.status(400).json({ error: 'no organization' })

    const forms = await listForms(user.organizationId)
    res.json(forms)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/intake/forms/:formId — Get form detail with submissions count
router.get('/forms/:formId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const formId = req.params.formId as string
    const form = await (await import('../models/prisma')).prisma.intakeForm.findUnique({
      where: { id: formId },
      include: {
        _count: { select: { submissions: true } },
      },
    })
    if (!form) return res.status(404).json({ error: 'form not found' })

    res.json(form)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// PATCH /api/intake/forms/:formId — Update form
router.patch('/forms/:formId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, formSchema } = req.body

    const formId = req.params.formId as string
    const form = await (await import('../models/prisma')).prisma.intakeForm.update({
      where: { id: formId },
      data: {
        ...(name ? { name } : {}),
        ...(formSchema !== undefined ? { formSchema } : {}),
      },
    })

    res.json(form)
  } catch (err) {
    if ((err as any).code === 'P2025') return res.status(404).json({ error: 'form not found' })
    res.status(500).json({ error: (err as Error).message })
  }
})

// DELETE /api/intake/forms/:formId — Delete form
router.delete('/forms/:formId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const formId = req.params.formId as string
    await (await import('../models/prisma')).prisma.intakeForm.delete({
      where: { id: formId },
    })
    res.status(204).send()
  } catch (err) {
    if ((err as any).code === 'P2025') return res.status(404).json({ error: 'form not found' })
    res.status(500).json({ error: (err as Error).message })
  }
})

// ── Admin: Submissions ────────────────────────────────────

// GET /api/intake/submissions — List submissions
router.get('/submissions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { formId, status } = req.query
    const submissions = await listSubmissions(
      formId as string | undefined,
      status as string | undefined,
      undefined,
    )
    res.json(submissions)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/intake/submissions/:submissionId — Get submission detail
router.get('/submissions/:submissionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const submissionId = req.params.submissionId as string
    const submission = await getSubmission(submissionId)
    if (!submission) return res.status(404).json({ error: 'submission not found' })

    // Parse answers JSON for convenience
    const result = { ...submission }
    if (typeof result.answers === 'string') {
      try { (result as any).answers = JSON.parse((result as any).answers) } catch { /* keep as string */ }
    }
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// PATCH /api/intake/submissions/:submissionId — Update submission status
router.patch('/submissions/:submissionId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, matterId } = req.body

    const validStatuses = ['PENDING', 'TRIAGED', 'CONVERTED', 'REJECTED']
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'invalid status. Must be one of: PENDING, TRIAGED, CONVERTED, REJECTED' })
    }

    const submissionId = req.params.submissionId as string
    const submission = await updateSubmissionStatus(submissionId, status, matterId || null)
    res.json(submission)
  } catch (err) {
    if ((err as any).code === 'P2025') return res.status(404).json({ error: 'submission not found' })
    res.status(500).json({ error: (err as Error).message })
  }
})

// ── AI Triage Endpoints ────────────────────────────────────

// POST /api/ai/intake/triage — AI-powered intake triage (public — no auth required)
router.post('/ai/intake/triage', async (req: Request, res: Response) => {
  try {
    const { formId, answers, orgId } = req.body

    if (!formId) return res.status(400).json({ error: 'formId required' })
    if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'answers required' })

    const aiService = getAiIntakeService()
    const matterTypeSvc = getMatterTypeService()

    // Get available matter types for grounding
    let matterTypeTitles: string[] = []
    try {
      const types = await matterTypeSvc.listTypes()
      matterTypeTitles = types.map((t: any) => t.title)
    } catch {
      // No matter types — will use default list in the service
    }

    const triageResult = await aiService.triageSubmission(
      formId,
      answers as Record<string, unknown>,
      orgId || '',
      matterTypeTitles,
    )

    res.json(triageResult)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/intake/:formId/submit-with-triage — Submit + auto-triage (public)
router.post('/:formId/submit-with-triage', async (req: Request, res: Response) => {
  try {
    const { submitter, answers } = req.body

    if (!submitter) return res.status(400).json({ error: 'submitter required' })
    if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'answers required' })

    const formId = req.params.formId as string

    // Get form to retrieve orgId
    const form = await (await import('../models/prisma')).prisma.intakeForm.findUnique({
      where: { id: formId },
      select: { orgId: true, formSchema: true },
    })
    if (!form) return res.status(404).json({ error: 'form not found' })

    // Create the submission
    const submission = await submitForm(formId, submitter, answers)

    // Triage in background (non-blocking)
    void (async () => {
      try {
        const aiService = getAiIntakeService()
        const matterTypeSvc = getMatterTypeService()

        let matterTypeTitles: string[] = []
        try {
          const types = await matterTypeSvc.listTypes()
          matterTypeTitles = types.map((t: any) => t.title)
        } catch { /* ignore */ }

        const triageResult = await aiService.triageSubmission(
          formId,
          answers,
          form.orgId,
          matterTypeTitles,
        )

        // Store the triage result with the submission
        await updateSubmissionTriage(submission.id, triageResult as unknown as Record<string, unknown>)
        console.log(`[Intake] Auto-triage complete for submission ${submission.id}: priority=${triageResult.priority}`)
      } catch (err) {
        console.error(`[Intake] Background triage failed for submission ${submission.id}:`, err)
      }
    })()

    // Return immediately with PENDING status
    res.status(201).json({
      submissionId: submission.id,
      status: 'PENDING',
      triage: { status: 'processing' },
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
