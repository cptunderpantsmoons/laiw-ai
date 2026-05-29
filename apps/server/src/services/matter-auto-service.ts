/**
 * MatterAutoService — auto-creates matters from intake submissions.
 *
 * Workflow:
 *  1. IntakeSubmission arrives with answers JSON
 *  2. AI triage analyzes answers → suggestedMatterType, suggestedMatterTitle, prefill
 *  3. Matter is created with triage-derived fields
 *  4. IntakeSubmission.status is set to RESOLVED
 *  5. Optional: initial SpendBudget is created if budgetEstimate in prefill
 */

import { Decimal } from '@prisma/client/runtime/library';
import { MatterTypeService } from './matter-type-service';
import { AiIntakeService, type TriageResult } from './ai-intake-service';
import { ChatService } from './chat-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of matter creation from an intake submission.
 */
export interface MatterFromIntakeResult {
  matterId: string;
  /** Extracted prefill fields for further use. */
  prefill: Record<string, string>;
}

/**
 * Options for the matter auto-service.
 */
export interface MatterAutoServiceOptions {
  aiIntakeService?: AiIntakeService;
}

// ---------------------------------------------------------------------------
// Prisma types — extended to include triageResult which may not be generated
// ---------------------------------------------------------------------------

interface IntakeSubmissionRaw {
  id: string;
  formId: string;
  submitter: string;
  answers: string;
  triageResult: string | null;
  status: 'RECEIVED' | 'TRIAGED' | 'IN_PROGRESS' | 'RESOLVED';
  matterId: string | null;
  createdAt: Date;
  updatedAt: Date;
  form: {
    id: string;
    name: string;
    orgId: string;
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class MatterAutoService {
  private readonly aiIntakeService: AiIntakeService;
  private readonly matterTypeService: MatterTypeService;

  constructor(opts: MatterAutoServiceOptions = {}) {
    this.matterTypeService = new MatterTypeService();
    if (opts.aiIntakeService) {
      this.aiIntakeService = opts.aiIntakeService;
    } else {
      // If no service provided, create one from the chat service
      const chatService = new ChatService();
      this.aiIntakeService = new AiIntakeService(chatService);
    }
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /**
   * Create a matter from an intake submission.
   *
   * Reads the IntakeSubmission (answers JSON), parses the triageResult
   * (if present) for suggestedMatterType, suggestedMatterTitle, prefill,
   * and creates a Matter record linked to the submission.
   *
   * Sets submission.status = 'RESOLVED'.
   */
  async createMatterFromIntake(
    submissionId: string,
  ): Promise<MatterFromIntakeResult> {
    // Lazy-load prisma to avoid circular import issues
    const { prisma } = await import('../models/prisma');

    // Fetch the submission with all needed fields
    const submission = await prisma.intakeSubmission.findUnique({
      where: { id: submissionId },
      include: { form: { select: { name: true, orgId: true } } },
    }) as unknown as IntakeSubmissionRaw;

    if (!submission) {
      throw new Error(`Intake submission not found: ${submissionId}`);
    }

    // Parse the answers JSON
    let answers: Record<string, unknown>;
    try {
      answers = typeof submission.answers === 'string'
        ? JSON.parse(submission.answers)
        : (submission.answers as Record<string, unknown>);
    } catch {
      throw new Error('Submission answers is not valid JSON');
    }

    // Parse the triage result if present
    let triageResult: TriageResult | null = null;
    if (submission.triageResult) {
      try {
        triageResult = JSON.parse(submission.triageResult) as TriageResult;
      } catch {
        console.warn(`[MatterAuto] Invalid triageResult JSON for submission ${submissionId}`);
      }
    }

    // Derive matter fields from triage result or answers
    const matterName = triageResult?.suggestedMatterTitle
      || this.extractField(answers, ['title', 'name', 'matterTitle', 'subject', 'caseTitle'])
      || `Matter from intake — ${submission.form.name}`;

    const matterDescription = triageResult
      ? this.buildDescriptionFromTriage(answers, triageResult)
      : this.buildDescriptionFromAnswers(answers);

    const matterType = triageResult?.suggestedMatterType
      || this.extractField(answers, ['matterType', 'category', 'type', 'practiceArea'])
      || 'General';

    // Determine orgId from the form's organization
    const orgId = submission.form.orgId;

    // Get the user who will own this matter (use the system user or org admin)
    // Since intake is public, we use the organization's admin
    const orgAdmin = await prisma.user.findFirst({
      where: {
        organizationId: orgId,
        role: 'ADMIN',
      },
      select: { id: true },
    });

    const ownerUserId = orgAdmin?.id ?? null;

    // Create the matter
    const matter = await prisma.matter.create({
      data: {
        name: matterName,
        description: matterDescription || null,
        orgId,
        matterType,
      },
    });

    // If there's an org admin, add them as a member
    if (ownerUserId) {
      await prisma.matterMember.create({
        data: {
          matterId: matter.id,
          userId: ownerUserId,
          role: 'owner',
        },
      });
    }

    // Link the intake submission to the matter
    await prisma.intakeSubmission.update({
      where: { id: submissionId },
      data: {
        matterId: matter.id,
        status: 'RESOLVED',
      },
    });

    // Extract prefill fields for downstream use
    const prefill = triageResult?.prefill ?? {};

    // If budget estimate is in prefill, create a SpendBudget
    if (prefill.budgetEstimate) {
      const budgetAmount = parseFloat(prefill.budgetEstimate);
      if (!isNaN(budgetAmount) && budgetAmount > 0) {
        try {
          await prisma.spendBudget.create({
            data: {
              matterId: matter.id,
              totalAmount: new Decimal(budgetAmount),
              currency: prefill.budgetCurrency || 'USD',
            },
          });
          console.log(`[MatterAuto] Created SpendBudget for matter ${matter.id}: ${budgetAmount}`);
        } catch (err) {
          console.error(`[MatterAuto] Failed to create SpendBudget:`, err);
          // Non-critical — do not block matter creation
        }
      }
    }

    console.log(`[MatterAuto] Created matter ${matter.id} from submission ${submissionId}`);

    return { matterId: matter.id, prefill };
  }

  /**
   * Full auto-triage-and-create pipeline.
   *
   * If the submission doesn't have a triageResult yet, calls the AI
   * triage service first, then creates the matter.
   */
  async autoTriageAndCreate(
    submissionId: string,
  ): Promise<{ matterId: string }> {
    // Lazy-load prisma
    const { prisma } = await import('../models/prisma');

    // Fetch the submission
    const submission = await prisma.intakeSubmission.findUnique({
      where: { id: submissionId },
      include: { form: { select: { name: true, orgId: true } } },
    }) as unknown as IntakeSubmissionRaw;

    if (!submission) {
      throw new Error(`Intake submission not found: ${submissionId}`);
    }

    // Check if triage has already been done
    let triageResult: TriageResult | null = null;
    if (submission.triageResult) {
      try {
        triageResult = JSON.parse(submission.triageResult) as TriageResult;
      } catch {
        // Invalid JSON — proceed without triage result
      }
    }

    // If no triage result yet, perform AI triage
    if (!triageResult) {
      let answers: Record<string, unknown>;
      try {
        answers = typeof submission.answers === 'string'
          ? JSON.parse(submission.answers)
          : (submission.answers as Record<string, unknown>);
      } catch {
        throw new Error('Submission answers is not valid JSON');
      }

      // Get matter type titles for grounding via MatterTypeService
      const typeTitles = await this.matterTypeService.listTypes();
      const titles = typeTitles.map((t: { title: string }) => t.title);

      try {
        triageResult = await this.aiIntakeService.triageSubmission(
          submission.formId,
          answers,
          submission.form.orgId,
          titles,
        );
      } catch (err) {
        console.error(`[MatterAuto] AI triage failed for submission ${submissionId}:`, err);
        // Fall back to a default triage result so matter creation can proceed
        triageResult = {
          suggestedMatterType: 'General',
          suggestedMatterTitle: `Matter from intake — ${submission.form.name}`,
          priority: 'MEDIUM',
          prefill: {},
          confidence: 0,
        };
      }

      // Store the triage result with the submission
      await prisma.intakeSubmission.update({
        where: { id: submissionId },
        data: {
          triageResult: JSON.stringify(triageResult),
          status: 'TRIAGED',
        },
      });

      console.log(
        `[MatterAuto] AI triage complete for submission ${submissionId}: priority=${triageResult.priority}`,
      );
    }

    // Now create the matter using the triage result
    const result = await this.createMatterFromIntake(submissionId);

    return { matterId: result.matterId };
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  /**
   * Extract the first matching field value from an object by key candidates.
   */
  private extractField(
    answers: Record<string, unknown>,
    candidates: string[],
  ): string | null {
    for (const key of candidates) {
      const value = answers[key];
      if (value != null && typeof value !== 'object') {
        return String(value).trim();
      }
    }
    return null;
  }

  /**
   * Build a human-readable description from AI triage results and answers.
   */
  private buildDescriptionFromTriage(
    answers: Record<string, unknown>,
    triageResult: TriageResult,
  ): string {
    const parts: string[] = [];

    const extracted = this.extractField(answers, [
      'description', 'descriptionOfIncident', 'summary', 'details',
      'caseDescription', 'incidentDescription', 'narrative',
    ]);
    if (extracted) parts.push(extracted);

    parts.push(`Priority: ${triageResult.priority}`);
    parts.push(`Matter Type: ${triageResult.suggestedMatterType}`);
    parts.push(`Confidence: ${Math.round(triageResult.confidence * 100)}%`);

    return parts.join('\n');
  }

  /**
   * Build a description directly from form answers.
   */
  private buildDescriptionFromAnswers(answers: Record<string, unknown>): string {
    const descriptionKeys = [
      'description', 'descriptionOfIncident', 'summary', 'details',
      'caseDescription', 'incidentDescription', 'narrative',
    ];

    for (const key of descriptionKeys) {
      const value = answers[key];
      if (value != null && typeof value !== 'object') {
        return String(value).trim();
      }
    }

    // Fallback: serialize all answers
    return JSON.stringify(answers, null, 2);
  }
}
