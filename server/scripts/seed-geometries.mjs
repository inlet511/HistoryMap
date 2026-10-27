/**
 * Seed faction_geometries from data/seed/faction_geometries.json.
 * Replaces all existing rows (idempotent re-run).
 *
 *   node scripts/seed-geometries.mjs
 *
 * Reads DATABASE_URL from server/.env via dotenv — password never on CLI.
 */
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(__dirname, '../../data/seed/faction_geometries.json');

if (!process.env.DATABASE_URL) {
  console.error('[seed-geom] DATABASE_URL is not set. Check server/.env');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const raw = readFileSync(dataPath, 'utf8');
  const rows = JSON.parse(raw);
  console.log(`[seed-geom] loaded ${rows.length} geometries from ${dataPath}`);

  // wipe + reinsert (idempotent)
  await pool.query('DELETE FROM faction_geometries');

  let inserted = 0;
  for (const r of rows) {
    await pool.query(
      `INSERT INTO faction_geometries (faction_id, start_year, end_year, geom, source)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [r.faction_id, r.start_year, r.end_year, JSON.stringify(r.geom), r.source],
    );
    inserted++;
  }
  console.log(`[seed-geom] inserted ${inserted} geometries`);

  const check = await pool.query(
    `SELECT fg.faction_id, f.name, fg.start_year, fg.end_year, fg.source
     FROM faction_geometries fg JOIN factions f ON f.id = fg.faction_id
     ORDER BY fg.start_year, f.name`,
  );
  console.log('[seed-geom] current geometries:');
  for (const row of check.rows) {
    console.log(`  ${row.name.padEnd(4)} (${row.faction_id}) ${row.start_year}~${row.end_year}  [${row.source}]`);
  }
} catch (err) {
  console.error('[seed-geom] failed:', err.message || err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
