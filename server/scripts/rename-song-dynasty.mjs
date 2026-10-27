/**
 * One-off: rename the "宋辽夏金" top-level dynasty to "宋朝" in the live DB,
 * so we don't have to re-seed (which would wipe user data later).
 *
 *   node scripts/rename-song-dynasty.mjs
 *
 * Reads DATABASE_URL from server/.env via dotenv — password never on CLI.
 */
import 'dotenv/config';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('[rename] DATABASE_URL is not set. Check server/.env');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const res = await pool.query(
    `UPDATE dynasties
     SET name = $1, name_en = $2, description = $3, updated_at = NOW()
     WHERE id = $4
       AND (name <> $1 OR name_en <> $2 OR description IS DISTINCT FROM $3)`,
    ['宋朝', 'Song (with Liao/Xia/Jin)', '两宋为主朝，与辽、西夏、金并立', 'song_liao_xia_jin'],
  );
  console.log(`[rename] rows updated: ${res.rowCount}`);
} catch (err) {
  console.error('[rename] failed:', err.message || err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
