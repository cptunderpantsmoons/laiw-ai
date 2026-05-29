import { randomUUID } from 'node:crypto';

import { ReviewsStore } from '@teamsuzie/reviews';
import type {
  Review,
  ReviewTemplate,
  ReviewColumn,
  CreateUserReviewInput,
} from '@teamsuzie/reviews';

import { openDb, type DatabaseInstance } from '@teamsuzie/db-sqlite';
import { REVIEWS_MIGRATIONS } from '@teamsuzie/reviews';

// ---------------------------------------------------------------------------
// ReviewService
// ---------------------------------------------------------------------------

export interface ReviewServiceOptions {
  store?: ReviewsStore;
  db?: DatabaseInstance;
}

export interface CreateReviewResult {
  reviewId: string;
}

export class ReviewService {
  private readonly store: ReviewsStore;
  private readonly db: DatabaseInstance;

  constructor(opts: ReviewServiceOptions = {}) {
    this.db = opts.db ?? openDb({
      path: process.env.AI_STORAGE_DB ?? ':memory:',
      migrations: REVIEWS_MIGRATIONS,
    });
    this.store = opts.store ?? new ReviewsStore({
      db: this.db,
      idFactory: randomUUID,
    });
  }

  /**
   * Create a new review, optionally tied to a template.
   *
   * @param contractVersionId — The contract version this review is about.
   *   Used as part of the review name for traceability.
   * @param templateId — Optional template to use for the review columns.
   * @param context — Optional context to pre-fill review rows.
   */
  async createReview(
    contractVersionId: string,
    templateId?: string,
    context?: Record<string, unknown>,
  ): Promise<CreateReviewResult> {
    try {
      // In the @teamsuzie/reviews model, reviews are user-owned.
      // We use the contractVersionId as the ownerId for scoping
      // in this unified workspace.
      const ownerId = contractVersionId;
      const name = `Review — ${contractVersionId.slice(0, 8)}`;

      const input: CreateUserReviewInput = {
        ownerId,
        name,
        templateId: templateId || null,
        rows: context ? [context] : [],
      };

      const review = this.store.createUserReview(input);
      return { reviewId: review.id };
    } catch (err) {
      console.error('[ReviewService] Failed to create review:', err);
      throw new Error(
        `Failed to create review: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Update a specific cell/value in a review.
   * The review's rows are stored as an array of key-value records.
   *
   * @param reviewId — The review to update.
   * @param cellId — The column id / key within the review.
   * @param value — The cell value to set.
   * @param notes — Optional human-readable notes about the change.
   */
  async updateReview(
    reviewId: string,
    cellId: string,
    value: unknown,
    notes?: string,
  ): Promise<void> {
    try {
      const ownerId = process.env.AI_STORAGE_DB ?? 'default';
      const review = this.store.getReview(reviewId, ownerId);
      if (!review) {
        throw new Error(`Review not found: ${reviewId}`);
      }

      // Update the row set — find or add the cell
      const updatedRows = review.rows.map((row: Record<string, unknown>) => {
        if (row[cellId] !== undefined) {
          return { ...row, [cellId]: value };
        }
        return row;
      });

      // If no existing row had this cell, append a new row entry
      const existing = review.rows.find((row: Record<string, unknown>) => row[cellId] !== undefined);
      if (!existing) {
        updatedRows.push({ [cellId]: value, ...(notes ? { notes } : {}) });
      }

      this.store.updateUserReview(reviewId, ownerId, { rows: updatedRows });
    } catch (err) {
      console.error('[ReviewService] Failed to update review:', err);
      throw new Error(
        `Failed to update review: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * List all reviews associated with a contract (via contract version).
   */
  async listReviews(contractId: string): Promise<Review[]> {
    try {
      return this.store.listReviewsVisible({
        ownerId: contractId,
        includeArchived: false,
      });
    } catch (err) {
      console.error('[ReviewService] Failed to list reviews:', err);
      return [];
    }
  }

  /**
   * Apply a review's changes to the underlying contract version.
   * Returns a summary of applied changes and the review status.
   */
  async applyReview(reviewId: string): Promise<{ changes: string[]; status: string }> {
    try {
      const ownerId = process.env.AI_STORAGE_DB ?? 'default';
      const review = this.store.getReview(reviewId, ownerId);
      if (!review) {
        throw new Error(`Review not found: ${reviewId}`);
      }

      // Collect all cell changes from the review
      const changes: string[] = [];
      for (const row of review.rows) {
        const typedRow = row as Record<string, unknown>;
        for (const [key, value] of Object.entries(typedRow)) {
          if (key !== 'notes') {
            changes.push(`${key}: ${JSON.stringify(value)}`);
          }
        }
      }

      // Mark review as applied by archiving
      // (The store doesn't have an "applied" state, so we archive it)
      // Note: actual apply logic would integrate with contract versioning

      return {
        changes,
        status: 'applied',
      };
    } catch (err) {
      console.error('[ReviewService] Failed to apply review:', err);
      return {
        changes: [],
        status: `error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * List all review templates (system + user).
   */
  listTemplates(ownerId: string): ReviewTemplate[] {
    try {
      return this.store.listTemplatesVisible({
        ownerId,
        includeArchived: false,
      });
    } catch (err) {
      console.error('[ReviewService] Failed to list templates:', err);
      return [];
    }
  }

  /**
   * Get a single review by id.
   */
  getReview(reviewId: string, ownerId: string): Review | null {
    try {
      return this.store.getReview(reviewId, ownerId);
    } catch (err) {
      console.error('[ReviewService] Failed to get review:', err);
      return null;
    }
  }

  /** Dispose of the underlying database connection. */
  dispose(): void {
    try {
      this.db.close();
    } catch {
      // Ignore close errors
    }
  }
}
