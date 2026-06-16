 const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StateData {
  state_id: number;
  state_code: string;
  state_name: string;
  region: string;
  division: string;
  population_2020: number;
  area_sq_miles: number;
  xpi_score: number;
  access_score: number;
  transit_score: number;
  income_score: number;
  composite_score: number;
}

export interface NationalStats {
  avg_score: number;
  max_score: number;
  min_score: number;
  dispersion: number;
  critical_count: number;
  top_state_code: string;
  top_state_name: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    // Cache 60 s côté Next.js (ISR-friendly)
    next: { revalidate: 60 },
  } as RequestInit);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

/** Tous les états avec leurs scores agrégés */
export const fetchAllStates = (): Promise<StateData[]> =>
  apiFetch<StateData[]>("/api/etats");

/** Un état spécifique par son code (ex: "CA", "TX") */
export const fetchStateByCode = (code: string): Promise<StateData> =>
  apiFetch<StateData>(`/api/etats/${code.toUpperCase()}`);

/** Statistiques nationales agrégées */
export const fetchNationalStats = (): Promise<NationalStats> =>
  apiFetch<NationalStats>("/api/stats/national");