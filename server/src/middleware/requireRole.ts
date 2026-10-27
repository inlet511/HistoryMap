import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '@utils/errors';
import { requireAuth } from './auth';

const ROLE_RANK: Record<string, number> = {
  reader: 0,
  user: 1,
  editor: 2,
  admin: 3,
};

/**
 * Require a minimum role.
 * requireRole('editor') allows editor AND admin (higher rank passes).
 * Hierarchy: reader < user < editor < admin
 */
export function requireRole(minRole: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      const user = req.user;
      const userRank = user ? (ROLE_RANK[user.role] ?? -1) : -1;
      const requiredRank = ROLE_RANK[minRole] ?? 99;
      if (userRank < requiredRank) {
        return next(
          new ForbiddenError(`Requires ${minRole} role or higher`),
        );
      }
      next();
    });
  };
}
