/**
 * AI Intake Service — auto-triage incoming intake form submissions.
 *
 * Uses the agent-loop (ChatService) to analyze form answers and return:
 *  - suggested matter type
 *  - suggested matter title
 *  - priority level (LOW | MEDIUM | HIGH | URGENT)
 *  - pre-fillable fields for Matter creation
 *  - confidence score (0-1)
 */

import { ChatService } from './chat-service';

export interface TriageResult {
  suggestedMatterType: string;
  suggestedMatterTitle: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  prefill: Record<string, string>;
  confidence: number;
}

const FALLBACK_RESULT: TriageResult = {
  suggestedMatterType: 'General',
  suggestedMatterTitle: 'Untitled Submission',
  priority: 'MEDIUM',
  prefill: {},
  confidence: 0,
};

const TRIAGE_SYSTEM_PROMPT =
  `You are a legal intake triage assistant. Given a set of form answers from a potential client, analyze the submission and return a JSON object with the following fields:

1. "suggestedMatterType": A string matching one of the known legal matter types. Choose the closest match, or "General" if unsure.
2. "suggestedMatterTitle": A concise, descriptive title for the potential legal matter (max 100 characters).
3. "priority": A string — "LOW", "MEDIUM", "HIGH", or "URGENT".
   - URGENT: immediate legal threat, court deadlines within days, active litigation, criminal charges
   - HIGH: time-sensitive matters, upcoming deadlines, active disputes
   - MEDIUM: standard intake requests, no immediate urgency
   - LOW: informational inquiries, general questions, no deadline
4. "prefill": An object of key-value pairs for pre-filling a Matter record. Extract any relevant fields like client name, contact info, case description, date of incident, etc.
5. "confidence": A number between 0 and 1 indicating how confident you are in the triage result.

Output ONLY valid JSON. No markdown, no explanation, no code fences.`;

export class AiIntakeService {
  private chatService: ChatService;

  constructor(chatService: ChatService) {
    this.chatService = chatService;
  }

  /**
   * Triage a single form submission.
   *
   * @param formId      — Prisma IntakeForm id
   * @param answers     — parsed form answers (key -> value)
   * @param orgId       — organization id (for context)
   * @param matterTypes — optional list of known matter type titles for grounding
   */
  async triageSubmission(
    formId: string,
    answers: Record<string, unknown>,
    orgId: string,
    matterTypes?: string[],
  ): Promise<TriageResult> {
    try {
      // Build the answers text for the LLM
      const answersText = Object.entries(answers)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

      const typesList = matterTypes && matterTypes.length > 0
        ? matterTypes.join(', ')
        : 'General, Contract Review, Employment, Family, Real Estate, Criminal, Immigration, Intellectual Property, Estate Planning, Corporate, Personal Injury, Tax, Administrative';

      const userPrompt = `Form ID: ${formId}
Organization: ${orgId}

Possible matter types: ${typesList}

Form answers:
${answersText}`;

      // Use ChatService.sendMessage for a non-streamed LLM call
      const response = await this.chatService.sendMessage(
        formId,
        userPrompt,
        'user',
      );

      // Parse the JSON response
      const parsed = this.parseTriageResponse(response, typesList);

      // Update the chat message to be the system prompt so it stays consistent
      // (the store appends our user message; we don't need to replace it)

      return parsed;
    } catch (err) {
      console.error('[AiIntakeService] Triage failed, using fallback:', err);
      return FALLBACK_RESULT;
    }
  }

  /**
   * Parse the LLM response into a TriageResult.
   */
  private parseTriageResponse(raw: string, typesList: string): TriageResult {
    // Try to extract JSON from the response (handles markdown code fences)
    let jsonStr = raw.trim();

    // Strip markdown code fences if present
    const codeFenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeFenceMatch) {
      jsonStr = codeFenceMatch[1].trim();
    }

    // Find the first { and last } to extract JSON
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    let parsed: Partial<TriageResult>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error('[AiIntakeService] Failed to parse triage JSON:', jsonStr);
      return FALLBACK_RESULT;
    }

    // Normalize and validate fields
    const suggestedMatterType =
      (parsed.suggestedMatterType as string) || 'General';
    const suggestedMatterTitle =
      (parsed.suggestedMatterTitle as string) || 'Untitled Submission';
    const priority = this.normalizePriority(
      parsed.priority as string,
      typesList,
    );
    const prefill = (parsed.prefill as Record<string, string>) || {};
    const confidence = Math.min(
      1,
      Math.max(0, (parsed.confidence as number) ?? 0.5),
    );

    return {
      suggestedMatterType,
      suggestedMatterTitle,
      priority,
      prefill,
      confidence,
    };
  }

  /**
   * Validate priority against allowed values and the types list.
   */
  private normalizePriority(raw: string, _typesList: string): TriageResult['priority'] {
    const valid: TriageResult['priority'][] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    const upper = raw.toUpperCase();
    return valid.includes(upper as any) ? (upper as TriageResult['priority']) : 'MEDIUM';
  }
}
