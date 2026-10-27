import { Router, type Request, type Response } from 'express';
import { pool } from '@db/pool';
import { logger } from '@utils/logger';

export const healthRouter = Router();

/**
 * Liveness check — process is up. Does NOT touch the DB.
 * GET /health
 */
healthRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness check — process can serve real traffic (DB reachable).
 * GET /ready
 */
healthRouter.get('/ready', async (_req: Request, res: Response) => {
  try {
    const r = await pool.query('SELECT 1 AS ok');
    if (r.rowCount === 1) {
      res.status(200).json({ status: 'ready', db: 'connected' });
    } else {
      res.status(503).json({ status: 'not_ready', db: 'no_response' });
    }
  } catch (err) {
    logger.error({ err }, 'Readiness DB check failed');
    res.status(503).json({ status: 'not_ready', db: 'error' });
  }
});
