/**
 * Typed error system.
 * - AppError: base class, carries HTTP status, code, details.
 * - Specific subclasses for common cases.
 * Global error handler maps these to a stable JSON shape.
 * Business code throws these; never returns raw stacks to client.
 */
export type ErrorDetails = Record<string, unknown>;

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ErrorDetails;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      code?: string;
      details?: ErrorDetails;
      isOperational?: boolean;
    } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? 'INTERNAL_ERROR';
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 400 — client sent bad input */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: ErrorDetails) {
    super(message, { statusCode: 400, code: 'VALIDATION_ERROR', details });
  }
}

/** 401 — not authenticated */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, { statusCode: 401, code: 'UNAUTHORIZED' });
  }
}

/** 403 — authenticated but lacks permission */
export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, { statusCode: 403, code: 'FORBIDDEN' });
  }
}

/** 404 — resource not found */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, { statusCode: 404, code: 'NOT_FOUND' });
  }
}

/** 409 — conflict (duplicate, stale version) */
export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: ErrorDetails) {
    super(message, { statusCode: 409, code: 'CONFLICT', details });
  }
}

/** 429 — too many requests */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, { statusCode: 429, code: 'TOO_MANY_REQUESTS' });
  }
}

/**
 * Wrap an unknown thrown value into an AppError.
 * Used by the global handler for non-AppError throws.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Error) {
    return new AppError(err.message, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      isOperational: false,
    });
  }
  return new AppError('An unexpected error occurred', {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    isOperational: false,
  });
}
