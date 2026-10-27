import { Router } from 'express';
import { authRateLimiter } from '@middleware/rateLimit';
import { requireAuth } from '@middleware/auth';
import { authController } from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, authController.register);
authRouter.post('/login', authRateLimiter, authController.login);
authRouter.post('/refresh', authRateLimiter, authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.me);
