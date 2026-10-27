/**
 * Create the target database if it does not yet exist.
 *
 * Connects to the default `postgres` database (parsed from DATABASE_URL) using
 * the same superuser credentials, then issues CREATE DATABASE.
 *
 * Run after `npm install` and before `npm run migrate`:
 *   node scripts/create-db.mjs
 *
 * The password never appears on the command line — it is read from .env via
 * dotenv, so this script is safe to run from any shell.
 */
import 'dotenv/config';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('[create-db] DATABASE_URL is not set. Check server/.env');
  process.exit(1);
}

const targetUrl = new URL(process.env.DATABASE_URL);
const targetDb = targetUrl.pathname.slice(1); // strip leading "/"

if (!targetDb) {
  console.error('[create-db] could not parse database name from DATABASE_URL');
  process.exit(1);
}

// Connect to the built-in `postgres` database to issue CREATE DATABASE.
const adminUrl = new URL(process.env.DATABASE_URL);
adminUrl.pathname = '/postgres';

const pool = new pg.Pool({ connectionString: adminUrl.toString() });

try {
  const res = await pool.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [targetDb],
  );
  if (res.rowCount && res.rowCount > 0) {
    console.log(`[create-db] database "${targetDb}" already exists — skipping`);
  } else {
    // CREATE DATABASE does not accept parameters; name comes from trusted .env.
    await pool.query(`CREATE DATABASE "${targetDb}"`);
    console.log(`[create-db] database "${targetDb}" created`);
  }
} catch (err) {
  console.error('[create-db] failed:', err.message || err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
