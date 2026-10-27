import cors from 'cors';
import { env } from '@config/env';

/**
 * CORS with explicit origins only — never wildcard in production.
 * Credentials enabled so refresh-token (HttpOnly) cookies flow through.
 */
export const corsMiddleware = cors({
  origin: (origin, cb) => {
    // Allow same-origin / no-origin (curl, server-to-server) and whitelisted
    if (!origin || env.CORS_ORIGINS.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: env.CORS_CREDENTIALS,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 600,
});
