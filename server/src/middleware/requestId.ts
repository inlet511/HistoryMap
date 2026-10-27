import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { requestContext } from '@utils/requestContext';

/**
 * Attach a request id (honor incoming header or generate one),
 * store it in AsyncLocalStorage, and echo it back in the response header.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = (req.headers['x-request-id'] as string | undefined)?.trim();
  const id = incoming || randomUUID();
  res.setHeader('X-Request-Id', id);
  requestContext.run({ requestId: id }, () => next());
}
