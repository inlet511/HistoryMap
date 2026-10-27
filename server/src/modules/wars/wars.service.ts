import { z } from 'zod';
import { query } from '@db/pool';
import { NotFoundError } from '@utils/errors';

export interface War {
  id: string;
  year: number;
  year_label: string;
  name: string;
  attacker_faction_id: string | null;
  defender_faction_id: string | null;
  attacker_label: string | null;
  defender_label: string | null;
  result: string | null;
  description: string | null;
}

const FIELDS =
  'id, year, year_label, name, attacker_faction_id, defender_faction_id, attacker_label, defender_label, result, description';

export async function listWars(): Promise<War[]> {
  return query<War>(`SELECT ${FIELDS} FROM wars ORDER BY year`);
}

export async function getWarsAtYear(year: number): Promise<War[]> {
  return query<War>(
    `SELECT ${FIELDS} FROM wars WHERE year = $1 ORDER BY name`,
    [year],
  );
}

export async function getWarsNearYear(
  year: number,
  range = 50,
): Promise<War[]> {
  return query<War>(
    `SELECT ${FIELDS} FROM wars WHERE year BETWEEN $1 AND $2 ORDER BY year`,
    [year - range, year + range],
  );
}

export async function getWarById(id: string): Promise<War> {
  const rows = await query<War>(`SELECT ${FIELDS} FROM wars WHERE id = $1`, [id]);
  if (rows.length === 0) throw new NotFoundError('War');
  return rows[0];
}

const upsertSchema = z.object({
  year: z.number().int(),
  year_label: z.string().min(1),
  name: z.string().min(1).max(200),
  attacker_faction_id: z.string().nullable().optional(),
  defender_faction_id: z.string().nullable().optional(),
  attacker_label: z.string().nullable().optional(),
  defender_label: z.string().nullable().optional(),
  result: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});
export type WarInput = z.infer<typeof upsertSchema>;

export async function createWar(input: WarInput): Promise<War> {
  const p = upsertSchema.parse(input);
  const rows = await query<War>(
    `INSERT INTO wars (year, year_label, name, attacker_faction_id, defender_faction_id, attacker_label, defender_label, result, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING ${FIELDS}`,
    [
      p.year,
      p.year_label,
      p.name,
      p.attacker_faction_id ?? null,
      p.defender_faction_id ?? null,
      p.attacker_label ?? null,
      p.defender_label ?? null,
      p.result ?? null,
      p.description ?? null,
    ],
  );
  return rows[0];
}

const updateSchema = upsertSchema.partial();
export type WarUpdate = z.infer<typeof updateSchema>;

export async function updateWar(id: string, input: WarUpdate): Promise<War> {
  const p = updateSchema.parse(input);
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue;
    sets.push(`${k} = $${i}`);
    vals.push(v);
    i++;
  }
  if (sets.length === 0) return getWarById(id);
  vals.push(id);
  const rows = await query<War>(
    `UPDATE wars SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${FIELDS}`,
    vals,
  );
  if (rows.length === 0) throw new NotFoundError('War');
  return rows[0];
}

export async function deleteWar(id: string): Promise<void> {
  const rows = await query('DELETE FROM wars WHERE id = $1 RETURNING id', [id]);
  if (rows.length === 0) throw new NotFoundError('War');
}
