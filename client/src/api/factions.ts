import { api } from './client';
import type { Faction } from '@/types';

export const factionsApi = {
  list: () => api.get<{ items: Faction[] }>('/factions'),
  atYear: (year: number) =>
    api.get<{ year: number; items: Faction[] }>(`/factions/at/${year}`),
  byDynasty: (dynastyId: string) =>
    api.get<{ items: Faction[] }>(`/factions`, { params: { dynasty_id: dynastyId } }),
  getById: (id: string) => api.get<Faction>(`/factions/${id}`),
  /** Range polygon as GeoJSON FeatureCollection (may be null if no data). */
  geometry: (id: string, year: number) =>
    api.get<GeoJSON.FeatureCollection | null>(`/factions/${id}/geometry`, { params: { year } }),
  /** All faction range polygons active at a given year, as a single FeatureCollection
   *  (each feature carries faction_id/name/color in properties for direct MapLibre styling). */
  geometriesAtYear: (year: number) =>
    api.get<GeoJSON.FeatureCollection>(`/factions/at/${year}/geometries`),
  create: (input: Partial<Faction> & { id: string; name: string; start_year: number; end_year: number; color: string }) =>
    api.post<Faction>('/factions', input),
  update: (id: string, input: Partial<Faction>) =>
    api.put<Faction>(`/factions/${id}`, input),
  remove: (id: string) => api.del(`/factions/${id}`),
};
