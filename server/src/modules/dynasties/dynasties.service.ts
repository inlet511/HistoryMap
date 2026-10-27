import { z } from 'zod';
import { query } from '@db/pool';
import { NotFoundError } from '@utils/errors';

export interface Dynasty {
  id: string;
  name: string;
  name_en: string | null;
  start_year: number;
  end_year: number;
  color: string;
  parent_id: string | null;
  sort_order: number;
  description: string | null;
}

const FIELDS =
  'id, name, name_en, start_year, end_year, color, parent_id, sort_order, description';

export async function listDynasties(): Promise<Dynasty[]> {
  return query<Dynasty>(
    `SELECT ${FIELDS} FROM dynasties ORDER BY sort_order, start_year`,
  );
}

export async function getDynastiesAtYear(year: number): Promise<Dynasty[]> {
  return query<Dynasty>(
    `SELECT ${FIELDS} FROM dynasties WHERE start_year <= $1 AND end_year >= $1 ORDER BY sort_order`,
    [year],
  );
}

export async function getDynastyById(id: string): Promise<Dynasty> {
  const rows = await query<Dynasty>(
    `SELECT ${FIELDS} FROM dynasties WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) throw new NotFoundError('Dynasty');
  return rows[0];
}

const upsertSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(60),
  name_en: z.string().max(60).nullable().optional(),
  start_year: z.number().int(),
  end_year: z.number().int(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be #RRGGBB'),
  parent_id: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  description: z.string().nullable().optional(),
});
export type DynastyInput = z.infer<typeof upsertSchema>;

export async function createDynasty(input: DynastyInput): Promise<Dynasty> {
  const p = upsertSchema.parse(input);
  const rows = await query<Dynasty>(
    `INSERT INTO dynasties (id, name, name_en, start_year, end_year, color, parent_id, sort_order, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING ${FIELDS}`,
    [
      p.id,
      p.name,
      p.name_en ?? null,
      p.start_year,
      p.end_year,
      p.color,
      p.parent_id ?? null,
      p.sort_order,
      p.description ?? null,
    ],
  );
  return rows[0];
}

const updateSchema = upsertSchema.partial();
export type DynastyUpdate = z.infer<typeof updateSchema>;

export async function updateDynasty(
  id: string,
  input: DynastyUpdate,
): Promise<Dynasty> {
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
  if (sets.length === 0) return getDynastyById(id);
  vals.push(id);
  const rows = await query<Dynasty>(
    `UPDATE dynasties SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${FIELDS}`,
    vals,
  );
  if (rows.length === 0) throw new NotFoundError('Dynasty');
  return rows[0];
}

export async function deleteDynasty(id: string): Promise<void> {
  const rows = await query('DELETE FROM dynasties WHERE id = $1 RETURNING id', [id]);
  if (rows.length === 0) throw new NotFoundError('Dynasty');
}
