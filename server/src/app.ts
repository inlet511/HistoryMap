import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';

import { env, isProd } from '@config/env';
import { logger } from '@utils/logger';
import { corsMiddleware } from '@middleware/cors';
import { apiRateLimiter } from '@middleware/rateLimit';
import { requestIdMiddleware } from '@middleware/requestId';
import { notFoundHandler } from '@middleware/notFound';
import { errorHandler } from '@middleware/errorHandler';
import { healthRouter } from './routes/health';
import { authMiddleware } from '@middleware/auth';
import { authRouter } from '@modules/auth/auth.router';
import { dynastiesRouter } from '@modules/dynasties/dynasties.router';
import { factionsRouter } from '@modules/factions/factions.router';
import { eventsRouter } from '@modules/events/events.router';
import { warsRouter } from '@modules/wars/wars.router';

/**
 * Build the Express app. Kept in a factory so tests can construct an isolated
 * app instance without binding to a port.
 */
export function createApp(): Express {
  const app = express();

  // Behind a proxy in prod — trust one hop for X-Forwarded-*
  app.set('trust proxy', isProd ? 1 : false);
  app.disable('x-powered-by');

  // --- Request id first (so logger + downstream can pick it up) ---
  app.use(requestIdMiddleware);

  // --- Structured HTTP logging (pino-http) — reuses the id set above ---
  app.use(
    pinoHttp({
      logger,
      genReqId: (req: Request) => (req as Request & { requestId?: string }).requestId,
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      autoLogging: {
        ignore: (req) => Boolean((req.url || '').match(/^\/(health|ready)(\/|$|\?)/)),
      },
    }),
  );

  // --- Security headers ---
  app.use(helmet());

  // --- Body parsers ---
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  // --- Compression (after body parsers) ---
  app.use(compression());

  // --- CORS (explicit origins) ---
  app.use(corsMiddleware);

  // --- Rate limit on /api ---
  app.use('/api', apiRateLimiter);

  // --- Health & readiness ---
  app.use(healthRouter); // mounts /health and /ready

  // --- Root ---
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'china-history-map-api',
      version: '0.1.0',
      env: env.NODE_ENV,
      docs: '/api',
    });
  });

  // --- Auth middleware: best-effort, attaches req.user when a valid
  // Bearer token is present. Does not reject unauthenticated requests. ---
  app.use(authMiddleware);

  // --- API v1 ---
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/dynasties', dynastiesRouter);
  app.use('/api/v1/factions', factionsRouter);
  app.use('/api/v1/events', eventsRouter);
  app.use('/api/v1/wars', warsRouter);

  app.get('/api', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: 'v1',
      modules: ['auth', 'dynasties', 'factions', 'events', 'wars', 'annotations', 'shares', 'data'],
      note: 'dynasties/factions/events/wars/annotations/shares/data routers wired in Phase 3',
    });
  });

  // --- 404 + global error handler MUST be last ---
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
