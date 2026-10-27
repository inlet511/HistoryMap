import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, toAppError } from '@utils/errors';
import { logger } from '@utils/logger';
import { getRequestId } from '@utils/requestContext';

interface ErrorResponseBody {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

/**
 * Global error handler — register LAST, after all routes and notFound.
 *
 * - AppError: use its statusCode/code/message
 * - ZodError: 400 with field-level issues
 * - everything else: 500 INTERNAL_ERROR; stack is logged but never sent
 *
 * Client always sees a stable shape: { code, message, details?, requestId? }
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response<ErrorResponseBody>,
  _next: NextFunction,
) {
  const requestId = getRequestId();
  const ctx = { requestId, path: req.path, method: req.method };

  if (err instanceof ZodError) {
    logger.warn({ ...ctx, issues: err.flatten() }, 'Validation error');
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: err.flatten(),
      requestId,
    });
  }

  const appErr = toAppError(err);

  if (appErr.isOperational) {
    logger.warn({ ...ctx, err: appErr }, 'Operational error');
  } else {
    logger.error(
      { ...ctx, err: appErr, stack: appErr.stack },
      'Unexpected error',
    );
  }

  const body: ErrorResponseBody = {
    code: appErr.code,
    message:
      appErr.statusCode < 500 ? appErr.message : 'Internal server error',
  };
  if (appErr.details) body.details = appErr.details;
  if (requestId) body.requestId = requestId;

  return res.status(appErr.statusCode).json(body);
}
