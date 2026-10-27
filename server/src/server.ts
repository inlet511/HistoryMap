import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from '@config/env';
import { logger } from '@utils/logger';
import { closePool } from '@db/pool';

const app = createApp();
const server = createServer(app);

const PORT = env.PORT;
const HOST = env.HOST;

server.listen(PORT, HOST, () => {
  logger.info(
    { port: PORT, host: HOST, env: env.NODE_ENV },
    `china-history-map-api listening on http://${HOST}:${PORT}`,
  );
});

// ---------------- Graceful shutdown ----------------
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown initiated');

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await closePool();
    } catch (err) {
      logger.error({ err }, 'Error closing PG pool during shutdown');
    }
    process.exit(0);
  });

  // Hard deadline: if connections don't drain in 20s, force exit
  setTimeout(() => {
    logger.error('Forced exit after shutdown timeout (20s)');
    process.exit(1);
  }, 20000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// ---------------- Unhandled error guards ----------------
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});
