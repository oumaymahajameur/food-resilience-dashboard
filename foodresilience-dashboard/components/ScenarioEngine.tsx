"use client";

import { useState, useCallback } from "react";

// ─── TYPES ─────────────────────────────

type ScenarioItem = {
  label: string;
  impact: number;
  width: number;
};

// ─── DATA ──────────────────────────────

const SCENARIOS: ScenarioItem[] = [
  { label: "CPI Shock", impact: -12, width: 60 },
  { label: "Supply Chain Recovery", impact: 8, width: 50 },
  { label: "Transport Disruption", impact: -6, width: 40 },
  { label: "Policy Intervention", impact: 10, width: 70 },
];

// ─── CONSTANTS ─────────────────────────

const FONT = "'Rajdhani','Share Tech Mono',monospace";

function impactColor(impact: number): string {
  if (impact > 0) return "#00f5d4";
  if (impact <= -14) return "#ef233c";
  return "#f77f00";
}

// ─── ROW COMPONENT ─────────────────────

function ScenarioRow({
  item,
  isLast,
}: {
  item: ScenarioItem;
  isLast: boolean;
}) {
  const color = impactColor(item.impact);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderBottom: isLast
          ? "none"
          : "1px solid rgba(0,245,212,0.05)",
        fontFamily: FONT,
      }}
    >
      {/* LABEL */}
      <div
        style={{
          flex: 1,
          fontSize: 11,
          color: "rgba(255,255,255,0.8)",
        }}
      >
        {item.label}
      </div>

      {/* BAR */}
      <div
        style={{
          width: 100,
          height: 6,
          background: "rgba(255,255,255,0.08)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${item.width}%`,
            background: color,
            borderRadius: 999,
            transition: "width 0.6s ease",
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      </div>

      {/* VALUE */}
      <div
        style={{
          width: 55,
          textAlign: "right",
          fontSize: 11,
          color,
          fontWeight: 700,
        }}
      >
        {item.impact > 0 ? "+" : ""}
        {item.impact} pts
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────

export default function ScenarioEngine() {
  const [scenarios, setScenarios] =
    useState<ScenarioItem[]>(SCENARIOS);

  const recalculate = useCallback(() => {
    setScenarios((prev) =>
      prev.map((s) => {
        const sign = s.impact >= 0 ? 1 : -1;

        return {
          ...s,
          impact: sign * (Math.round(Math.random() * 20) + 2),
          width: Math.round(30 + Math.random() * 60),
        };
      })
    );
  }, []);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        margin: 0,                 // 🔥 align LEFT
        alignSelf: "flex-start",   // 🔥 fix grid
        padding: "12px 14px",
        fontFamily: FONT,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 9,
            letterSpacing: 3,
            color: "rgba(0,245,212,0.4)",
          }}
        >
          SCENARIO ENGINE
        </span>

        <button
          onClick={recalculate}
          style={{
            fontSize: 9,
            padding: "4px 10px",
            border: "1px solid rgba(0,245,212,0.25)",
            borderRadius: 4,
            background: "transparent",
            color: "#00f5d4",
            cursor: "pointer",
            fontFamily: FONT,
          }}
        >
          ↺ RECALC
        </button>
      </div>

      {/* ROWS */}
      {scenarios.map((s, i) => (
        <ScenarioRow
          key={s.label}
          item={s}
          isLast={i === scenarios.length - 1}
        />
      ))}
    </div>
  );
}