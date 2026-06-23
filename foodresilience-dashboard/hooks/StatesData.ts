"use client";

import { useCallback, useEffect, useState } from "react";

export interface StateData {
  state_id: number;
  state_code: string;
  state_name: string;
  region: string;
  division: string;
  population_2020: number;
  area_sq_miles: number;
  cpi_score: number;
  access_score: number;
  transit_score: number;
  income_score: number;
  composite_score: number;
  alert_type?: string;
  alert_message?: string;
}

export interface TrendPoint {
  month_num: number;
  month_name: string;
  composite_score: number;
  cpi_score: number;
  access_score: number;
  transit_score: number;
  income_score: number;
  year: number;
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

export interface ResilienceRow {
  state_name: string;
  state_abbr: string;
  resilience_score: number;
}

export function scoreColor(score: number): string {
  if (score >= 75) return "#00d97e";
  if (score >= 60) return "#f5a623";
  if (score >= 45) return "#f77f00";
  return "#ef233c";
}

function mapState(s: any): StateData {
  const scores = Array.isArray(s.fact_resilience_scores)
    ? s.fact_resilience_scores[0]
    : s.fact_resilience_scores;
  return {
    ...s,
    composite_score: scores?.resilience_score ?? 0,
    cpi_score:       scores?.cpi_score        ?? 0,
    access_score:    scores?.access_score      ?? 0,
    transit_score:   scores?.transit_score     ?? 0,
    income_score:    scores?.econ_score        ?? 0,
  };
}

export function useAllStates() {
  const [states, setStates] = useState<StateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/etats`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: any[]) => { setStates(data.map(mapState)); })
      .catch((err) => { console.error(err); setError(err.message); })
      .finally(() => { setLoading(false); });
  }, [trigger]);

  const refetch = useCallback(() => { setTrigger((t) => t + 1); }, []);
  return { states, loading, error, refetch };
}

export function useStateByCode(code: string | null) {
  const [state, setState] = useState<StateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError(null);
    fetch(`/api/etats/${code}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: any) => { setState(mapState(data)); })
      .catch((err) => { console.error(err); setError(err.message); })
      .finally(() => { setLoading(false); });
  }, [code]);

  return { state, loading, error };
}

export function useStateTrends(code: string | null) {
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError(null);
    fetch(`/api/etats/${code}/trends`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: TrendPoint[]) => { setTrends(data); })
      .catch((err) => { console.error(err); setError(err.message); })
      .finally(() => { setLoading(false); });
  }, [code]);

  return {
    trends,
    compositeArray: trends.map((t) => Number(t.composite_score)),
    cpiArray:       trends.map((t) => Number(t.cpi_score)),
    accessArray:    trends.map((t) => Number(t.access_score)),
    transitArray:   trends.map((t) => Number(t.transit_score)),
    incomeArray:    trends.map((t) => Number(t.income_score)),
    loading,
    error,
  };
}

export function useNationalStats() {
  const [stats, setStats] = useState<NationalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/stats/national`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: NationalStats) => { setStats(data); })
      .catch((err) => { console.error(err); setError(err.message); })
      .finally(() => { setLoading(false); });
  }, [trigger]);

  const refetch = useCallback(() => { setTrigger((t) => t + 1); }, []);
  return { stats, loading, error, refetch };
}

export function useDashboardData() {
  const [states, setStates] = useState<StateData[]>([]);
  const [national, setNational] = useState<NationalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/etats`)
        .then((r) => { if (!r.ok) throw new Error(`/api/etats HTTP ${r.status}`); return r.json(); })
        .then((data: any[]) => data.map(mapState) as StateData[]),
      fetch(`/api/stats/national`)
        .then((r) => { if (!r.ok) throw new Error(`/api/stats/national HTTP ${r.status}`); return r.json(); })
        .then((data: any) => {
          const sorted = data;
          return {
            avg_score:      sorted.avg_score,
            max_score:      sorted.max_score,
            min_score:      sorted.min_score,
            dispersion:     sorted.dispersion,
            critical_count: sorted.critical_count,
            top_state_code: sorted.top_state_code ?? "",
            top_state_name: sorted.top_state_name ?? "",
          } as NationalStats;
        }),
    ])
      .then(([statesData, nationalData]) => { setStates(statesData); setNational(nationalData); })
      .catch((err) => { console.error(err); setError(err.message); })
      .finally(() => { setLoading(false); });
  }, [trigger]);

  const refetch = useCallback(() => { setTrigger((t) => t + 1); }, []);
  return { states, national, loading, error, refetch };
}

export function stateDataToLegacy(s: StateData) {
  return {
    name:        s.state_name,
    abbr:        s.state_code,
    cpiScore:    Number(s.cpi_score),
    accessScore: Number(s.access_score),
    transitScore:Number(s.transit_score),
    incomeScore: Number(s.income_score),
    composite:   Number(s.composite_score),
    population:  s.population_2020,
    alerts: s.alert_type
      ? [{ type: s.alert_type, msg: s.alert_message ?? "" }]
      : [{ type: "OK", msg: "Stable performance" }],
  };
}