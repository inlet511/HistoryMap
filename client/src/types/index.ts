// ============ Domain types ============

export interface Dynasty {
  id: string;
  name: string;
  name_en?: string | null;
  start_year: number;
  end_year: number;
  color: string;
  parent_id?: string | null;
  sort_order: number;
  description?: string | null;
}

export interface Faction {
  id: string;
  dynasty_id?: string | null;
  name: string;
  name_en?: string | null;
  start_year: number;
  end_year: number;
  color: string;
  type?: string | null;
  capital?: string | null;
  capital_lat?: number | null;
  capital_lng?: number | null;
  description?: string | null;
}

export interface FactionGeometry {
  id: string;
  faction_id: string;
  start_year: number;
  end_year: number;
  geojson: GeoJSON.FeatureCollection;
  source?: string | null;
}

export interface HistoryEvent {
  id: string;
  year: number;
  year_label: string;
  title: string;
  type: string;
  description?: string | null;
  location_label?: string | null;
  lat?: number | null;
  lng?: number | null;
  dynasty_id?: string | null;
  faction_ids?: string[];
}

export interface War {
  id: string;
  year: number;
  year_label: string;
  name: string;
  attacker_faction_id?: string | null;
  defender_faction_id?: string | null;
  attacker_label?: string | null;
  defender_label?: string | null;
  result?: string | null;
  description?: string | null;
}

// ============ Auth types ============

export type UserRole = 'reader' | 'user' | 'editor' | 'admin';

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  display_name?: string | null;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

// ============ Map types ============

export type BaseMapStyle = 'admin' | 'satellite' | 'terrain' | 'none';

export interface ViewState {
  year: number;
  center: [number, number];
  zoom: number;
  selectedFactionId?: string | null;
  baseMap: BaseMapStyle;
}
