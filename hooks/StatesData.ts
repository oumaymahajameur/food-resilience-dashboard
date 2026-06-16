// hooks/useStatesData.ts
"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
  alert_type?: string;
  alert_message?: string;
}

export interface TrendPoint {
  month_num: number;
  month_name: string;
  composite_score: number;
  xpi_score: number;
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

export function useAllStates() {
  const [states, setStates] = useState<StateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/etats`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: StateData[]) => {
        setStates(data);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [trigger]);

  const refetch = useCallback(() => {
    setTrigger((t) => t + 1);
  }, []);

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

    fetch(`${API_BASE}/api/etats/${code}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: StateData) => {
        setState(data);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
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

    fetch(`${API_BASE}/api/etats/${code}/trends`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: TrendPoint[]) => {
        setTrends(data);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [code]);

  return {
    trends,
    compositeArray: trends.map((t) => Number(t.composite_score)),
    xpiArray: trends.map((t) => Number(t.xpi_score)),
    accessArray: trends.map((t) => Number(t.access_score)),
    transitArray: trends.map((t) => Number(t.transit_score)),
    incomeArray: trends.map((t) => Number(t.income_score)),
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

    fetch(`${API_BASE}/api/stats/national`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: NationalStats) => {
        setStats(data);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [trigger]);

  const refetch = useCallback(() => {
    setTrigger((t) => t + 1);
  }, []);

  return { stats, loading, error, refetch };
}

// ✅ Version corrigée : ne met pas useAllStates() ou useNationalStats() ici
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
      fetch(`${API_BASE}/api/etats`).then((r) => {
        if (!r.ok) throw new Error(`/api/etats HTTP ${r.status}`);
        return r.json() as Promise<StateData[]>;
      }),

      fetch(`${API_BASE}/api/stats/national`).then((r) => {
        if (!r.ok) throw new Error(`/api/stats/national HTTP ${r.status}`);
        return r.json() as Promise<NationalStats>;
      }),
    ])
      .then(([statesData, nationalData]) => {
        setStates(statesData);
        setNational(nationalData);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [trigger]);

  const refetch = useCallback(() => {
    setTrigger((t) => t + 1);
  }, []);

  return { states, national, loading, error, refetch };
}

export function stateDataToLegacy(s: StateData) {
  return {
    name: s.state_name,
    abbr: s.state_code,
    xpiScore: Number(s.xpi_score),
    accessScore: Number(s.access_score),
    transitScore: Number(s.transit_score),
    incomeScore: Number(s.income_score),
    composite: Number(s.composite_score),
    population: s.population_2020,
    alerts: s.alert_type
      ? [{ type: s.alert_type, msg: s.alert_message ?? "" }]
      : [{ type: "OK", msg: "Stable performance" }],
  };
}