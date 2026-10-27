import { z } from 'zod';

/**
 * Central environment variable schema & validation.
 * All config is loaded once at startup; fail-fast if invalid.
 * Never read process.env directly in business code — import `env` instead.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('localhost'),

  DATABASE_URL: z.string().url(),
  PG_POOL_MAX: z.coerce.number().int().positive().default(10),
  PG_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  PG_POOL_IDLE_TIMEOUT: z.coerce.number().int().positive().default(30000),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_COOKIE_NAME: z.string().default('refresh_token'),
  JWT_REFRESH_COOKIE_DOMAIN: z.string().default('localhost'),
  JWT_REFRESH_COOKIE_PATH: z.string().default('/'),

  CORS_ORIGINS: z
    .string()
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),

  CLIENT_URL: z.string().url(),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Use console here because logger is not yet available.
    // eslint-disable-next-line no-console
    console.error('[config] Invalid environment variables:');
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
    );
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadConfig();
export type Env = typeof env;

/** Convenience booleans */
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
