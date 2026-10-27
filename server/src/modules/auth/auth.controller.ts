import type { Request, Response, NextFunction } from 'express';
import { env, isProd } from '@config/env';
import { UnauthorizedError } from '@utils/errors';
import * as service from './auth.service';
import { registerSchema, loginSchema } from './auth.types';

export const authController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = registerSchema.parse(req.body);
      const result = await service.register(input, {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });
      setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
      res.status(201).json({ user: result.user, accessToken: result.accessToken });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = loginSchema.parse(req.body);
      const result = await service.login(input, {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });
      setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
      res.json({ user: result.user, accessToken: result.accessToken });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies[env.JWT_REFRESH_COOKIE_NAME];
      if (!refreshToken) throw new UnauthorizedError('Missing refresh token');
      const result = await service.refresh(refreshToken, {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });
      setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
      res.json({ user: result.user, accessToken: result.accessToken });
    } catch (err) {
      // Bad refresh → clear cookie so browser stops sending it
      clearRefreshCookie(res);
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies[env.JWT_REFRESH_COOKIE_NAME];
      await service.logout(refreshToken);
      clearRefreshCookie(res);
      res.json({ message: 'Logged out' });
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response): Promise<void> {
    res.json({ user: req.user ?? null });
  },
};

function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(env.JWT_REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    domain: env.JWT_REFRESH_COOKIE_DOMAIN || undefined,
    path: env.JWT_REFRESH_COOKIE_PATH,
    expires: expiresAt,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(env.JWT_REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    domain: env.JWT_REFRESH_COOKIE_DOMAIN || undefined,
    path: env.JWT_REFRESH_COOKIE_PATH,
  });
}
