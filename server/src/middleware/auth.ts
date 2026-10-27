import type { Request, Response, NextFunction } from 'express';
import { getUserFromAccessToken } from '@modules/auth/auth.service';
import { getRequestContext } from '@utils/requestContext';
import { UnauthorizedError } from '@utils/errors';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      email: string;
      username: string;
      role: string;
      displayName?: string | null;
    };
  }
}

/**
 * Best-effort auth: parse Bearer token if present, attach req.user on success.
 * Does NOT reject unauthenticated requests — pair with `requireAuth` on
 * protected routes, or use `requireRole` for RBAC.
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = undefined;
    return next();
  }
  const token = authHeader.slice(7);
  try {
    const user = await getUserFromAccessToken(token);
    req.user = user;
    const ctx = getRequestContext();
    if (ctx) {
      ctx.userId = user.id;
    }
  } catch {
    // Invalid token — treat as unauthenticated, let requireAuth handle 401
    req.user = undefined;
  }
  next();
}

/** Reject if no authenticated user. Use on protected routes. */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }
  next();
}
