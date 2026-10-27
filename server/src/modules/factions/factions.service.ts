import { z } from 'zod';
import { query } from '@db/pool';
import { NotFoundError } from '@utils/errors';

export interface Faction {
  id: string;
  dynasty_id: string | null;
  name: string;
  name_en: string | null;
  start_year: number;
  end_year: number;
  color: string;
  type: string | null;
  capital: string | null;
  capital_lat: number | null;
  capital_lng: number | null;
  description: string | null;
}

const FIELDS =
  'id, dynasty_id, name, name_en, start_year, end_year, color, type, capital, capital_lat, capital_lng, description';

export async function listFactions(): Promise<Faction[]> {
  return query<Faction>(
    `SELECT ${FIELDS} FROM factions ORDER BY start_year, name`,
  );
}

export async function getFactionsAtYear(year: number): Promise<Faction[]> {
  return query<Faction>(
    `SELECT ${FIELDS} FROM factions WHERE start_year <= $1 AND end_year >= $1 ORDER BY name`,
    [year],
  );
}

export async function getFactionsByDynasty(dynastyId: string): Promise<Faction[]> {
  return query<Faction>(
    `SELECT ${FIELDS} FROM factions WHERE dynasty_id = $1 ORDER BY start_year`,
    [dynastyId],
  );
}

export async function getFactionById(id: string): Promise<Faction> {
  const rows = await query<Faction>(`SELECT ${FIELDS} FROM factions WHERE id = $1`, [id]);
  if (rows.length === 0) throw new NotFoundError('Faction');
  return rows[0];
}

/** Faction range polygon (GeoJSON) for a given year. geom column stores raw GeoJSON as jsonb. */
export async function getFactionGeometry(
  factionId: string,
  year: number,
): Promise<GeoJSON.FeatureCollection | null> {
  const rows = await query<{
    geojson: GeoJSON.Geometry;
    source: string | null;
  }>(
    `SELECT geom AS geojson, source
     FROM faction_geometries
     WHERE faction_id = $1 AND start_year <= $2 AND end_year >= $2
     ORDER BY start_year DESC LIMIT 1`,
    [factionId, year],
  );
  if (rows.length === 0) return null;
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: rows[0].geojson,
        properties: { source: rows[0].source },
      },
    ],
  };
}

/** All faction range polygons active at a given year, as a single GeoJSON FeatureCollection.
 *  Each feature's properties carry faction_id/name/color/dynasty_id for direct MapLibre styling. */
export async function getFactionsGeometryAtYear(
  year: number,
): Promise<GeoJSON.FeatureCollection> {
  interface Row {
    faction_id: string;
    name: string;
    color: string;
    dynasty_id: string | null;
    start_year: number;
    end_year: number;
    source: string | null;
    geom: GeoJSON.Geometry;
  }
  const rows = await query<Row>(
    `SELECT DISTINCT ON (f.id) f.id AS faction_id, f.name, f.color, f.dynasty_id,
            fg.geom AS geom, fg.start_year, fg.end_year, fg.source
     FROM faction_geometries fg
     JOIN factions f ON f.id = fg.faction_id
     WHERE fg.start_year <= $1 AND fg.end_year >= $1
     ORDER BY f.id, fg.start_year DESC`,
    [year],
  );
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature' as const,
      geometry: r.geom,
      properties: {
        faction_id: r.faction_id,
        name: r.name,
        color: r.color,
        dynasty_id: r.dynasty_id,
        start_year: r.start_year,
        end_year: r.end_year,
        source: r.source,
      },
    })),
  };
}

const upsertSchema = z.object({
  id: z.string().min(1).max(60),
  dynasty_id: z.string().nullable().optional(),
  name: z.string().min(1).max(60),
  name_en: z.string().max(60).nullable().optional(),
  start_year: z.number().int(),
  end_year: z.number().int(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  type: z.string().nullable().optional(),
  capital: z.string().nullable().optional(),
  capital_lat: z.number().nullable().optional(),
  capital_lng: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
});
export type FactionInput = z.infer<typeof upsertSchema>;

export async function createFaction(input: FactionInput): Promise<Faction> {
  const p = upsertSchema.parse(input);
  const rows = await query<Faction>(
    `INSERT INTO factions (id, dynasty_id, name, name_en, start_year, end_year, color, type, capital, capital_lat, capital_lng, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING ${FIELDS}`,
    [
      p.id,
      p.dynasty_id ?? null,
      p.name,
      p.name_en ?? null,
      p.start_year,
      p.end_year,
      p.color,
      p.type ?? null,
      p.capital ?? null,
      p.capital_lat ?? null,
      p.capital_lng ?? null,
      p.description ?? null,
    ],
  );
  return rows[0];
}

const updateSchema = upsertSchema.partial();
export type FactionUpdate = z.infer<typeof updateSchema>;

export async function updateFaction(id: string, input: FactionUpdate): Promise<Faction> {
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
  if (sets.length === 0) return getFactionById(id);
  vals.push(id);
  const rows = await query<Faction>(
    `UPDATE factions SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${FIELDS}`,
    vals,
  );
  if (rows.length === 0) throw new NotFoundError('Faction');
  return rows[0];
}

export async function deleteFaction(id: string): Promise<void> {
  const rows = await query('DELETE FROM factions WHERE id = $1 RETURNING id', [id]);
  if (rows.length === 0) throw new NotFoundError('Faction');
}
