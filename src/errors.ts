/**
 * Uniform error shape for all Manifold Markets tool errors.
 * Per FR-021: every error category uses this single shape.
 */

export type ErrorCategory = "upstream" | "auth" | "network" | "timeout" | "validation";

export class ManifoldError extends Error {
  readonly category: ErrorCategory;
  readonly status?: number;
  readonly body?: string;

  constructor(category: ErrorCategory, message: string, status?: number, body?: string) {
    super(message);
    this.name = "ManifoldError";
    this.category = category;
    this.status = status;
    this.body = body;
  }
}
