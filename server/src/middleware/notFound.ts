import type { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '@utils/errors';

/** Catches unmatched routes → forwards to errorHandler as a 404. */
export function notFoundHandler(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(new NotFoundError('Endpoint'));
}
