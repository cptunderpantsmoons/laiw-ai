import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import {
  getReviewService,
} from '../services/index.js'

const router: Router = Router()


// ── AI Review Routes ────────────────────────────────────

// POST /api/ai/review — Create a new review
router.post('/ai/review', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { contractVersionId, templateId, context } = req.body
    if (!contractVersionId) return res.status(400).json({ error: 'contractVersionId required' })

    const reviewService = getReviewService()
    const result = await reviewService.createReview(contractVersionId as string, templateId, context)
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/ai/reviews — List reviews for a contract
router.get('/ai/reviews', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const contractId = req.query.contractId as string
    if (!contractId) return res.status(400).json({ error: 'contractId query param required' })

    const reviewService = getReviewService()
    const reviews = await reviewService.listReviews(contractId)
    res.json(reviews)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// PATCH /api/ai/review/:reviewId — Update a review cell
router.patch('/ai/review/:reviewId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const reviewId = req.params.reviewId as string
    const { cellId, value, notes } = req.body
    if (!cellId) return res.status(400).json({ error: 'cellId required' })
    if (value === undefined) return res.status(400).json({ error: 'value required' })

    const reviewService = getReviewService()
    await reviewService.updateReview(reviewId, cellId, value, notes)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/ai/review/:reviewId/apply — Apply review changes
router.post('/ai/review/:reviewId/apply', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const reviewId = req.params.reviewId as string

    const reviewService = getReviewService()
    const result = await reviewService.applyReview(reviewId)
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
