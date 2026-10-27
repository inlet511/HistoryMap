import { z } from 'zod';
import { query } from '@db/pool';
import { NotFoundError } from '@utils/errors';

export interface HistoryEvent {
  id: string;
  year: number;
  year_label: string;
  title: string;
  type: string;
  description: string | null;
  location_label: string | null;
  lat: number | null;
  lng: number | null;
  dynasty_id: string | null;
  faction_ids: string[];
}

const FIELDS =
  'id, year, year_label, title, type, description, location_label, lat, lng, dynasty_id, faction_ids';

export async function listEvents(): Promise<HistoryEvent[]> {
  return query<HistoryEvent>(`SELECT ${FIELDS} FROM events ORDER BY year`);
}

/** Events within +/- range years of `year` (for the right-side event panel). */
export async function getEventsNearYear(
  year: number,
  range = 50,
): Promise<HistoryEvent[]> {
  return query<HistoryEvent>(
    `SELECT ${FIELDS} FROM events WHERE year BETWEEN $1 AND $2 ORDER BY year`,
    [year - range, year + range],
  );
}

export async function getEventsAtYear(year: number): Promise<HistoryEvent[]> {
  return query<HistoryEvent>(
    `SELECT ${FIELDS} FROM events WHERE year = $1 ORDER BY title`,
    [year],
  );
}

export async function getEventById(id: string): Promise<HistoryEvent> {
  const rows = await query<HistoryEvent>(
    `SELECT ${FIELDS} FROM events WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) throw new NotFoundError('Event');
  return rows[0];
}

const upsertSchema = z.object({
  year: z.number().int(),
  year_label: z.string().min(1),
  title: z.string().min(1).max(200),
  type: z.string().default('event'),
  description: z.string().nullable().optional(),
  location_label: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  dynasty_id: z.string().nullable().optional(),
  faction_ids: z.array(z.string()).default([]),
});
export type EventInput = z.infer<typeof upsertSchema>;

export async function createEvent(input: EventInput): Promise<HistoryEvent> {
  const p = upsertSchema.parse(input);
  const rows = await query<HistoryEvent>(
    `INSERT INTO events (year, year_label, title, type, description, location_label, lat, lng, dynasty_id, faction_ids)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING ${FIELDS}`,
    [
      p.year,
      p.year_label,
      p.title,
      p.type,
      p.description ?? null,
      p.location_label ?? null,
      p.lat ?? null,
      p.lng ?? null,
      p.dynasty_id ?? null,
      p.faction_ids,
    ],
  );
  return rows[0];
}

const updateSchema = upsertSchema.partial();
export type EventUpdate = z.infer<typeof updateSchema>;

export async function updateEvent(
  id: string,
  input: EventUpdate,
): Promise<HistoryEvent> {
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
  if (sets.length === 0) return getEventById(id);
  vals.push(id);
  const rows = await query<HistoryEvent>(
    `UPDATE events SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${FIELDS}`,
    vals,
  );
  if (rows.length === 0) throw new NotFoundError('Event');
  return rows[0];
}

export async function deleteEvent(id: string): Promise<void> {
  const rows = await query('DELETE FROM events WHERE id = $1 RETURNING id', [id]);
  if (rows.length === 0) throw new NotFoundError('Event');
}
