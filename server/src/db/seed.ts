import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

import { pool, withTransaction } from '@db/pool';
import { logger } from '@utils/logger';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data', 'seed');

interface DynastySeed {
  id: string;
  name: string;
  name_en?: string;
  start_year: number;
  end_year: number;
  color: string;
  parent_id?: string | null;
  sort_order?: number;
  description?: string;
}

interface FactionSeed {
  id: string;
  dynasty_id?: string | null;
  name: string;
  name_en?: string;
  start_year: number;
  end_year: number;
  color: string;
  type?: string;
  capital?: string;
  capital_lat?: number;
  capital_lng?: number;
  description?: string;
}

interface EventSeed {
  year: number;
  year_label: string;
  title: string;
  type: string;
  description?: string;
  location_label?: string;
  lat?: number;
  lng?: number;
  dynasty_id?: string | null;
  faction_ids?: string[];
}

interface WarSeed {
  year: number;
  year_label: string;
  name: string;
  attacker_faction_id?: string | null;
  defender_faction_id?: string | null;
  attacker_label?: string;
  defender_label?: string;
  result?: string;
  description?: string;
}

function readJson<T>(name: string): T[] {
  const p = join(DATA_DIR, name);
  const raw = readFileSync(p, 'utf-8');
  return JSON.parse(raw) as T[];
}

async function seed(): Promise<void> {
  const dynasties = readJson<DynastySeed>('dynasties.json');
  const factions = readJson<FactionSeed>('factions.json');
  const events = readJson<EventSeed>('events.json');
  const wars = readJson<WarSeed>('wars.json');

  logger.info(
    { dynasties: dynasties.length, factions: factions.length, events: events.length, wars: wars.length },
    'Seed data loaded',
  );

  await withTransaction(async (client) => {
    // Clean domain tables (reverse dependency order)
    await client.query(
      'TRUNCATE change_logs, share_links, annotations, refresh_tokens, users, wars, events, faction_geometries, factions, dynasties RESTART IDENTITY CASCADE',
    );

    // --- dynasties ---
    for (const d of dynasties) {
      await client.query(
        `INSERT INTO dynasties (id, name, name_en, start_year, end_year, color, parent_id, sort_order, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          d.id,
          d.name,
          d.name_en ?? null,
          d.start_year,
          d.end_year,
          d.color,
          d.parent_id ?? null,
          d.sort_order ?? 0,
          d.description ?? null,
        ],
      );
    }

    // --- factions ---
    for (const f of factions) {
      await client.query(
        `INSERT INTO factions (id, dynasty_id, name, name_en, start_year, end_year, color, type, capital, capital_lat, capital_lng, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          f.id,
          f.dynasty_id ?? null,
          f.name,
          f.name_en ?? null,
          f.start_year,
          f.end_year,
          f.color,
          f.type ?? null,
          f.capital ?? null,
          f.capital_lat ?? null,
          f.capital_lng ?? null,
          f.description ?? null,
        ],
      );
    }

    // --- events ---
    for (const e of events) {
      await client.query(
        `INSERT INTO events (year, year_label, title, type, description, location_label, lat, lng, dynasty_id, faction_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          e.year,
          e.year_label,
          e.title,
          e.type,
          e.description ?? null,
          e.location_label ?? null,
          e.lat ?? null,
          e.lng ?? null,
          e.dynasty_id ?? null,
          e.faction_ids ?? [],
        ],
      );
    }

    // --- wars ---
    for (const w of wars) {
      await client.query(
        `INSERT INTO wars (year, year_label, name, attacker_faction_id, defender_faction_id, attacker_label, defender_label, result, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          w.year,
          w.year_label,
          w.name,
          w.attacker_faction_id ?? null,
          w.defender_faction_id ?? null,
          w.attacker_label ?? null,
          w.defender_label ?? null,
          w.result ?? null,
          w.description ?? null,
        ],
      );
    }

    // --- default admin user ---
    const hash = await bcrypt.hash('admin123456', 10);
    await client.query(
      `INSERT INTO users (email, username, password_hash, role, display_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
      ['admin@example.com', 'admin', hash, 'admin', 'Administrator'],
    );
  });

  logger.info('Seed completed successfully');
  logger.info('Default admin: admin@example.com / admin123456 (change in production!)');
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, 'Seed failed');
    pool.end().finally(() => process.exit(1));
  });
