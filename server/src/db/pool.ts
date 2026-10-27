import { Pool, type PoolClient, type PoolConfig } from 'pg';
import { env } from '@config/env';
import { logger } from '@utils/logger';

const poolConfig: PoolConfig = {
  connectionString: env.DATABASE_URL,
  max: env.PG_POOL_MAX,
  min: env.PG_POOL_MIN,
  idleTimeoutMillis: env.PG_POOL_IDLE_TIMEOUT,
  connectionTimeoutMillis: 5000,
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PG pool error');
});

/** Run a query on the shared pool. Returns rows. */
export async function query<
  T extends Record<string, unknown> = Record<string, unknown>,
>(text: string, params?: unknown[]): Promise<T[]> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const ms = Date.now() - start;
  if (ms > 100) {
    logger.debug({ text, ms, rows: res.rowCount }, 'slow query');
  }
  return res.rows;
}

/** Acquire a client (for multi-statement work). Caller MUST release(). */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Execute a callback inside a transaction; rollback on error.
 * Never call client.query('BEGIN'/'COMMIT'/'ROLLBACK') inside fn yourself.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Drain the pool — call on graceful shutdown. */
export async function closePool(): Promise<void> {
  await pool.end();
  logger.info('PG pool closed');
}
