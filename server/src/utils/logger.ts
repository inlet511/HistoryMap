import pino from 'pino';
import { env, isProd } from '@config/env';

/**
 * Structured JSON logger (pino).
 * Carries request id automatically when used with pino-http middleware.
 * Never log passwords, tokens, or PII — caller's responsibility.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'china-history-map-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[REDACTED]',
  },
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname,service',
        },
      },
});

export type Logger = typeof logger;
