import { authMiddleware, type AuthRequest } from '../auth/middleware.js'

/**
 * Matter Auto Routes — endpoints for auto-indexing and auto-creating matters
 * from intake submissions.
 *
 * POST /api/matter-auto/triage-and-create — AI triage + matter creation from submission
 * POST /api/matter-auto/create — Create matter from intake answers (no AI)
 * POST /api/matter-auto/index-context — Trigger auto-indexing of matter context
 */

import { Router, Request, Response } from 'express';
import { getAutoIndexService, getMatterAutoService } from '../services';

const router = Router();


// ---------------------------------------------------------------------------
// POST /api/matter-auto/triage-and-create
//
// Performs AI triage on an intake submission and auto-creates a matter.
//
// Request body:
//   { submissionId: string }
//
// Response:
//   { matterId: string }
// ---------------------------------------------------------------------------

router.post('/matter-auto/triage-and-create', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { submissionId } = req.body;

    if (!submissionId) {
      return res.status(400).json({ error: 'submissionId required' });
    }

    const matterAutoService = getMatterAutoService();
    const result = await matterAutoService.autoTriageAndCreate(submissionId);

    res.status(201).json(result);
  } catch (err) {
    const message = (err as Error).message;
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/matter-auto/create
//
// Creates a matter from an intake submission without AI triage.
// Requires the submission to already have a triageResult.
//
// Request body:
//   { submissionId: string }
//
// Response:
//   { matterId: string, prefill: Record<string, string> }
// ---------------------------------------------------------------------------

router.post('/matter-auto/create', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { submissionId } = req.body;

    if (!submissionId) {
      return res.status(400).json({ error: 'submissionId required' });
    }

    const matterAutoService = getMatterAutoService();
    const result = await matterAutoService.createMatterFromIntake(submissionId);

    res.status(201).json(result);
  } catch (err) {
    const message = (err as Error).message;
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/matter-auto/index-context
//
// Triggers auto-indexing of all documents and contracts for a matter into
// the knowledge base, making them searchable by the AI agent.
//
// Request body:
//   { matterId: string }
//
// Response:
//   { status: string, indexedDocuments: number, indexedContracts: number }
// ---------------------------------------------------------------------------

router.post('/matter-auto/index-context', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { matterId } = req.body;

    if (!matterId) {
      return res.status(400).json({ error: 'matterId required' });
    }

    // Verify matter belongs to user's org
    const prisma = (await import('../models/prisma')).prisma;
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      return res.status(400).json({ error: 'no organization' });
    }

    const matter = await prisma.matter.findFirst({
      where: { id: matterId, orgId: user.organizationId },
      select: { id: true },
    });
    if (!matter) {
      return res.status(404).json({ error: 'matter not found or not accessible' });
    }

    const autoIndexService = getAutoIndexService();

    // Get the context before indexing
    const context = await autoIndexService.getMatterContext(matterId);

    // Index in background (non-blocking)
    void autoIndexService.indexMatterContext(matterId, user.organizationId);

    res.status(201).json({
      status: 'indexing_started',
      matterId,
      documentIds: context.documentIds,
      contractIds: context.contractIds,
    });
  } catch (err) {
    const message = (err as Error).message;
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/matter-auto/context/:matterId
//
// Returns the list of indexed document and contract IDs for a matter.
// This endpoint can be used by the frontend to show what context is
// available for AI queries.
// ---------------------------------------------------------------------------

router.get('/matter-auto/context/:matterId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const matterId = req.params.matterId as string;

    // Verify matter belongs to user's org
    const prisma = (await import('../models/prisma')).prisma;
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      return res.status(400).json({ error: 'no organization' });
    }

    const matter = await prisma.matter.findFirst({
      where: { id: matterId, orgId: user.organizationId },
      select: { id: true, name: true },
    });
    if (!matter) {
      return res.status(404).json({ error: 'matter not found or not accessible' });
    }

    const autoIndexService = getAutoIndexService();
    const context = await autoIndexService.getMatterContext(matterId);

    res.json({
      matterId,
      matterName: matter.name,
      documentIds: context.documentIds,
      contractIds: context.contractIds,
    });
  } catch (err) {
    const message = (err as Error).message;
    res.status(500).json({ error: message });
  }
});

export default router;
