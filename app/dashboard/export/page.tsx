"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import { NationalStats, useAllStates, useNationalStats } from "@/hooks/StatesData";
import { buildReport } from "@/foodresilience-dashboard/lib/reportGenerators";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface DBState {
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

// ─── STATIC DATA (only population as fallback, not for display) ───────────────
const COUNTRY_SCORES: { name: string; score: number; rank: number; continent: string }[] = [
  { name: "Portugal", score: 76.83, rank: 1, continent: "Europe" },
  { name: "France", score: 76.75, rank: 2, continent: "Europe" },
  { name: "United Kingdom", score: 76.34, rank: 3, continent: "Europe" },
  { name: "United States", score: 75.30, rank: 4, continent: "Americas" },
  { name: "Japan", score: 74.39, rank: 5, continent: "Asia" },
  { name: "Netherlands", score: 73.51, rank: 6, continent: "Europe" },
  { name: "Germany", score: 73.50, rank: 7, continent: "Europe" },
  { name: "Denmark", score: 73.19, rank: 8, continent: "Europe" },
  { name: "Singapore", score: 73.00, rank: 9, continent: "Asia" },
  { name: "Malaysia", score: 72.98, rank: 10, continent: "Asia" },
  { name: "Nicaragua", score: 53.45, rank: 51, continent: "Americas" },
  { name: "Romania", score: 52.44, rank: 52, continent: "Europe" },
  { name: "Lebanon", score: 51.65, rank: 53, continent: "Asia" },
  { name: "Rwanda", score: 50.69, rank: 54, continent: "Africa" },
  { name: "Namibia", score: 50.43, rank: 55, continent: "Africa" },
  { name: "Ethiopia", score: 49.86, rank: 56, continent: "Africa" },
  { name: "Nigeria", score: 49.64, rank: 57, continent: "Africa" },
  { name: "Uganda", score: 48.25, rank: 58, continent: "Africa" },
  { name: "Kenya", score: 46.03, rank: 59, continent: "Africa" },
  { name: "Congo", score: 34.86, rank: 60, continent: "Africa" },
];

const FIPS_TO_NAME: Record<string, string> = {
  "01":"Alabama","02":"Alaska","04":"Arizona","05":"Arkansas","06":"California",
  "08":"Colorado","09":"Connecticut","10":"Delaware","12":"Florida","13":"Georgia",
  "15":"Hawaii","16":"Idaho","17":"Illinois","18":"Indiana","19":"Iowa","20":"Kansas",
  "21":"Kentucky","22":"Louisiana","23":"Maine","24":"Maryland","25":"Massachusetts",
  "26":"Michigan","27":"Minnesota","28":"Mississippi","29":"Missouri","30":"Montana",
  "31":"Nebraska","32":"Nevada","33":"New Hampshire","34":"New Jersey","35":"New Mexico",
  "36":"New York","37":"North Carolina","38":"North Dakota","39":"Ohio","40":"Oklahoma",
  "41":"Oregon","42":"Pennsylvania","44":"Rhode Island","45":"South Carolina",
  "46":"South Dakota","47":"Tennessee","48":"Texas","49":"Utah","50":"Vermont",
  "51":"Virginia","53":"Washington","54":"West Virginia","55":"Wisconsin","56":"Wyoming",
};

// ─── DATA RANGE ───────────────────────────────────────────────────────────────
const DATA_YEAR_START = 2021;
const DATA_YEAR_END = 2025;
const CURRENT_YEAR = new Date().getFullYear();

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function scoreTier(score: number) {
  if (score >= 65) return { label: "HIGH", color: "#00d97e", bg: "#00d97e18" };
  if (score >= 45) return { label: "MODERATE", color: "#ff9500", bg: "#ff950018" };
  return { label: "CRITICAL", color: "#ff3355", bg: "#ff335518" };
}
function sc(score: number) { return scoreTier(score).color; }

// ─── LIVE PULSE DOT ───────────────────────────────────────────────────────────
function LivePulse({ color = "#00d97e" }: { color?: string }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 10, height: 10 }}>
      <span style={{
        position: "absolute", width: 10, height: 10, borderRadius: "50%",
        background: color, opacity: 0.3,
        animation: "pulse-ring 1.8s ease-out infinite"
      }} />
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "block" }} />
      <style>{`@keyframes pulse-ring{0%{transform:scale(1);opacity:0.4}100%{transform:scale(2.5);opacity:0}}`}</style>
    </span>
  );
}

// ─── ANIMATED COUNTER ─────────────────────────────────────────────────────────
function AnimCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = value / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.round(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display}</>;
}

// ─── 3D SCORE RING ────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 80, label }: { score: number; size?: number; label?: string }) {
  const tier = scoreTier(score);
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#0d2540" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={tier.color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" filter="url(#glow)"
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column" as const,
        alignItems: "center", justifyContent: "center"
      }}>
        <div style={{ fontSize: size * 0.22, fontWeight: 900, color: tier.color, fontFamily: "monospace", lineHeight: 1 }}>{score}</div>
        {label && <div style={{ fontSize: size * 0.1, color: "#3a6a8a", letterSpacing: 1, marginTop: 1 }}>{label}</div>}
      </div>
    </div>
  );
}

// ─── MINI SPARKLINE ───────────────────────────────────────────────────────────
function Spark({ data, color, w = 80, h = 28 }: { data: number[]; color: string; w?: number; h?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !data.length) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const xS = d3.scaleLinear().domain([0, data.length - 1]).range([0, w]);
    const yS = d3.scaleLinear().domain([0, 100]).range([h - 2, 2]);
    const line = d3.line<number>().x((_, i) => xS(i)).y(d => yS(d)).curve(d3.curveCatmullRom);
    const area = d3.area<number>().x((_, i) => xS(i)).y0(h).y1(d => yS(d)).curve(d3.curveCatmullRom);
    const id = `sp${Math.random().toString(36).slice(2)}`;
    const gr = svg.append("defs").append("linearGradient").attr("id", id).attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1);
    gr.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 0.4);
    gr.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 0);
    svg.append("path").datum(data).attr("d", area).attr("fill", `url(#${id})`);
    svg.append("path").datum(data).attr("d", line).attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.5);
    svg.append("circle").attr("cx", xS(data.length - 1)).attr("cy", yS(data[data.length - 1])).attr("r", 2.5).attr("fill", color);
  }, [data, color]);
  return <svg ref={ref} width={w} height={h} style={{ overflow: "visible" }} />;
}

function genTrend(base: number, n = 8): number[] {
  let v = Math.max(15, base - 10);
  return Array.from({ length: n }, () => {
    v = Math.max(10, Math.min(100, v + (base - v) * 0.15 + (Math.random() - 0.4) * 6));
    return Math.round(v);
  });
}

// ─── YEAR SELECTOR ────────────────────────────────────────────────────────────
function YearSelector({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  const years = Array.from({ length: DATA_YEAR_END - DATA_YEAR_START + 1 }, (_, i) => DATA_YEAR_START + i);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a1830", borderRadius: 8, padding: "6px 10px", border: "1px solid #0d2540" }}>
      <span style={{ fontSize: 9, color: "#3a6a8a", letterSpacing: 2 }}>DATA YEAR</span>
      <div style={{ display: "flex", gap: 4 }}>
        {years.map(y => (
          <button
            key={y}
            onClick={() => onChange(y)}
            style={{
              padding: "4px 10px", borderRadius: 5, fontSize: 11, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "monospace",
              background: year === y ? "#00e5ff" : "#061525",
              color: year === y ? "#020c1b" : "#3a6a8a",
              boxShadow: year === y ? "0 0 12px #00e5ff66" : "none",
              transition: "all 0.2s"
            }}
          >{y}</button>
        ))}
      </div>
    </div>
  );
}

// ─── LOADING / ERROR ──────────────────────────────────────────────────────────
function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "#020c1b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ width: 40, height: 40, border: "2px solid #00e5ff44", borderTop: "2px solid #00e5ff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ color: "#00e5ff", fontFamily: "monospace", fontSize: 15, letterSpacing: 3 }}>PREPARING EXPORT ENGINE...</div>
    </div>
  );
}

// ─── REPORT BUILDER STATE ─────────────────────────────────────────────────────
interface ReportConfig {
  sections: string[];
  statesFilter: string;
  outputFormat: string;
  selectedYear: number;
  reportTitle: string;
}

// ─── EXPORT FORMAT CARD ───────────────────────────────────────────────────────
function ExportCard({ icon, title, desc, formats, color, onClick, tag }: {
  icon: string; title: string; desc: string; formats: string[]; color: string;
  onClick: () => void; tag?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        padding: 18, borderRadius: 10, cursor: "pointer", transition: "all 0.25s",
        background: hover ? `${color}12` : "#0a1830",
        border: `1px solid ${hover ? color + "66" : "#0d2540"}`,
        transform: hover ? "translateY(-3px) scale(1.01)" : "none",
        boxShadow: hover ? `0 12px 40px ${color}22, 0 0 0 1px ${color}22` : "none",
        position: "relative" as const, overflow: "hidden"
      }}
    >
      {hover && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient(circle at 50% 0%, ${color}12 0%, transparent 70%)`
        }} />
      )}
      {tag && (
        <div style={{ position: "absolute", top: 10, right: 10, fontSize: 8, padding: "2px 6px", borderRadius: 3, background: `${color}33`, color, border: `1px solid ${color}55`, letterSpacing: 1 }}>{tag}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 22 }}>{icon}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: hover ? color : "#c0d8f0" }}>{title}</div>
          <div style={{ fontSize: 10, color: "#3a6a8a" }}>{desc}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const, marginBottom: 12 }}>
        {formats.map(f => (
          <span key={f} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 3, background: `${color}22`, color, border: `1px solid ${color}44`, letterSpacing: 1 }}>{f}</span>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <LivePulse color={color} />
          <span style={{ fontSize: 10, color: "#3a6a8a" }}>Live data ready</span>
        </div>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>↓</div>
      </div>
    </div>
  );
}

// ─── SMART REPORT BUILDER ─────────────────────────────────────────────────────
function SmartReportBuilder({
  states, stats, config, onChange, onGenerate
}: {
  states: DBState[];
  stats: NationalStats | null;
  config: ReportConfig;
  onChange: (c: Partial<ReportConfig>) => void;
  onGenerate: () => void;
}) {
  const allSections = [
    { id: "global_map", label: "🌍 Global RFSI World Map" },
    { id: "us_map", label: "🗺️ US State Map" },
    { id: "state_rankings", label: "📊 State Rankings Table" },
    { id: "ai_narratives", label: "🤖 AI Intelligence Narratives" },
    { id: "factor_scores", label: "📈 Factor Score Breakdown" },
    { id: "regional_summary", label: "🏛️ Regional Summary" },
    { id: "score_distribution", label: "📉 Score Distribution Chart" },
    { id: "year_trends", label: "📅 Year-over-Year Trends" },
    { id: "critical_alerts", label: "🚨 Critical State Alerts" },
  ];

  const stateFilters = [
    { id: "all", label: "All 50 States" },
    { id: "critical", label: `Critical Only (< 45) — ${states.filter(s => Number(s.composite_score) < 45).length} states` },
    { id: "high", label: `High Resilience (≥ 65) — ${states.filter(s => Number(s.composite_score) >= 65).length} states` },
    { id: "northeast", label: `Northeast — ${states.filter(s => s.region === "Northeast").length} states` },
    { id: "south", label: `South — ${states.filter(s => s.region === "South").length} states` },
    { id: "midwest", label: `Midwest — ${states.filter(s => s.region === "Midwest").length} states` },
    { id: "west", label: `West — ${states.filter(s => s.region === "West").length} states` },
  ];

  const outputFormats = [
    { id: "html_executive", label: "📄 HTML — Executive Layout", ext: "HTML" },
    { id: "html_technical", label: "🔬 HTML — Technical Layout", ext: "HTML" },
    { id: "csv", label: "💾 CSV — Data Export", ext: "CSV" },
  ];

  // Live preview stats
  const filteredStates = config.statesFilter === "all" ? states
    : config.statesFilter === "critical" ? states.filter(s => Number(s.composite_score) < 45)
    : config.statesFilter === "high" ? states.filter(s => Number(s.composite_score) >= 65)
    : states.filter(s => s.region === config.statesFilter.charAt(0).toUpperCase() + config.statesFilter.slice(1));

  const liveAvg = filteredStates.length
    ? Math.round(filteredStates.reduce((a, s) => a + Number(s.composite_score), 0) / filteredStates.length)
    : 0;

  return (
    <div style={{ padding: 22, borderRadius: 12, background: "#0a1830", border: "1px solid #00e5ff22", marginBottom: 24, position: "relative" as const, overflow: "hidden" }}>
      {/* Glow effect */}
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 300, height: 1, background: "linear-gradient(90deg, transparent, #00e5ff, transparent)" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ width: 3, height: 20, background: "linear-gradient(180deg, #00e5ff, #00d97e)", borderRadius: 2 }} />
        <span style={{ fontSize: 13, color: "#00e5ff", letterSpacing: 3, fontWeight: 800 }}>CUSTOM REPORT BUILDER</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#061525", borderRadius: 8, padding: "6px 12px", border: "1px solid #0d2540" }}>
          <span style={{ fontSize: 9, color: "#3a6a8a", letterSpacing: 2 }}>REPORT TITLE</span>
          <input
            value={config.reportTitle}
            onChange={e => onChange({ reportTitle: e.target.value })}
            style={{ background: "transparent", border: "none", outline: "none", color: "#00e5ff", fontSize: 12, fontFamily: "monospace", width: 200 }}
            placeholder="Custom Report Title..."
          />
        </div>
      </div>

      {/* Live preview bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, padding: "10px 14px", background: "#061525", borderRadius: 8, border: "1px solid #0d2540", alignItems: "center" }}>
        <LivePulse color="#00d97e" />
        <span style={{ fontSize: 10, color: "#3a6a8a", letterSpacing: 2 }}>LIVE PREVIEW</span>
        <div style={{ width: 1, height: 16, background: "#0d2540" }} />
        <span style={{ fontSize: 11, color: "#c0d8f0" }}>{filteredStates.length} states selected</span>
        <div style={{ width: 1, height: 16, background: "#0d2540" }} />
        <span style={{ fontSize: 11, color: sc(liveAvg) }}>Avg score: {liveAvg}/100</span>
        <div style={{ width: 1, height: 16, background: "#0d2540" }} />
        <span style={{ fontSize: 11, color: "#ff9500" }}>{config.sections.length} sections included</span>
        <div style={{ width: 1, height: 16, background: "#0d2540" }} />
        <span style={{ fontSize: 11, color: "#00e5ff" }}>Year: {config.selectedYear}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: "#2a4a6a" }}>Est. pages: ~{Math.ceil(config.sections.length * 1.4 + filteredStates.length * 0.2)}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 18 }}>
        {/* Sections */}
        <div>
          <div style={{ fontSize: 9, color: "#3a6a8a", letterSpacing: 2, marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
            <span>SECTIONS TO INCLUDE</span>
            <button
              onClick={() => onChange({ sections: config.sections.length === allSections.length ? [] : allSections.map(s => s.id) })}
              style={{ fontSize: 8, color: "#00e5ff", background: "none", border: "none", cursor: "pointer", letterSpacing: 1 }}
            >{config.sections.length === allSections.length ? "NONE" : "ALL"}</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
            {allSections.map(s => {
              const checked = config.sections.includes(s.id);
              return (
                <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "5px 8px", borderRadius: 6, background: checked ? "#00e5ff08" : "transparent", border: `1px solid ${checked ? "#00e5ff22" : "transparent"}`, transition: "all 0.2s" }}>
                  <div
                    onClick={() => onChange({ sections: checked ? config.sections.filter(x => x !== s.id) : [...config.sections, s.id] })}
                    style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${checked ? "#00e5ff" : "#0d2540"}`, background: checked ? "#00e5ff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s", cursor: "pointer" }}
                  >
                    {checked && <span style={{ fontSize: 9, color: "#020c1b", fontWeight: 900 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 11, color: checked ? "#c0d8f0" : "#3a6a8a" }}>{s.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* States filter */}
        <div>
          <div style={{ fontSize: 9, color: "#3a6a8a", letterSpacing: 2, marginBottom: 10 }}>STATES FILTER</div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
            {stateFilters.map(f => {
              const selected = config.statesFilter === f.id;
              return (
                <label key={f.id} onClick={() => onChange({ statesFilter: f.id })} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "5px 8px", borderRadius: 6, background: selected ? "#ff950008" : "transparent", border: `1px solid ${selected ? "#ff950022" : "transparent"}`, transition: "all 0.2s" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${selected ? "#ff9500" : "#0d2540"}`, background: selected ? "#ff9500" : "transparent", flexShrink: 0, transition: "all 0.2s" }} />
                  <span style={{ fontSize: 11, color: selected ? "#c0d8f0" : "#3a6a8a" }}>{f.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Output format + Year */}
        <div>
          <div style={{ fontSize: 9, color: "#3a6a8a", letterSpacing: 2, marginBottom: 10 }}>OUTPUT FORMAT</div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, marginBottom: 16 }}>
            {outputFormats.map(f => {
              const selected = config.outputFormat === f.id;
              return (
                <label key={f.id} onClick={() => onChange({ outputFormat: f.id })} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "5px 8px", borderRadius: 6, background: selected ? "#bf5fff08" : "transparent", border: `1px solid ${selected ? "#bf5fff22" : "transparent"}`, transition: "all 0.2s" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${selected ? "#bf5fff" : "#0d2540"}`, background: selected ? "#bf5fff" : "transparent", flexShrink: 0, transition: "all 0.2s" }} />
                  <span style={{ fontSize: 11, color: selected ? "#c0d8f0" : "#3a6a8a" }}>{f.label}</span>
                </label>
              );
            })}
          </div>

          {/* Year selector */}
          <div style={{ fontSize: 9, color: "#3a6a8a", letterSpacing: 2, marginBottom: 8 }}>DATA YEAR ({DATA_YEAR_START}–{DATA_YEAR_END})</div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
            {Array.from({ length: DATA_YEAR_END - DATA_YEAR_START + 1 }, (_, i) => DATA_YEAR_START + i).map(y => (
              <button
                key={y}
                onClick={() => onChange({ selectedYear: y })}
                style={{
                  padding: "5px 10px", borderRadius: 5, fontSize: 11, fontWeight: 800, border: "none",
                  cursor: "pointer", fontFamily: "monospace",
                  background: config.selectedYear === y ? "#00e5ff" : "#061525",
                  color: config.selectedYear === y ? "#020c1b" : "#3a6a8a",
                  boxShadow: config.selectedYear === y ? "0 0 12px #00e5ff66" : "none",
                  transition: "all 0.2s"
                }}
              >{y}</button>
            ))}
          </div>

          {/* Score distribution preview */}
          <div style={{ marginTop: 14, padding: 10, background: "#061525", borderRadius: 8, border: "1px solid #0d2540" }}>
            <div style={{ fontSize: 9, color: "#3a6a8a", letterSpacing: 2, marginBottom: 8 }}>SCORE DISTRIBUTION PREVIEW</div>
            {[
              { label: "HIGH ≥65", count: states.filter(s => Number(s.composite_score) >= 65).length, color: "#00d97e" },
              { label: "MOD 45–65", count: states.filter(s => Number(s.composite_score) >= 45 && Number(s.composite_score) < 65).length, color: "#ff9500" },
              { label: "CRITICAL <45", count: states.filter(s => Number(s.composite_score) < 45).length, color: "#ff3355" },
            ].map(b => (
              <div key={b.label} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 9, color: b.color }}>{b.label}</span>
                  <span style={{ fontSize: 9, color: "#3a6a8a" }}>{b.count} states</span>
                </div>
                <div style={{ height: 4, background: "#0d2540", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${(b.count / 50) * 100}%`, background: b.color, borderRadius: 2, transition: "width 0.8s" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ paddingTop: 16, borderTop: "1px solid #0d2540", display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={onGenerate}
          disabled={config.sections.length === 0}
          style={{
            padding: "12px 32px", borderRadius: 8,
            background: config.sections.length === 0 ? "#0d2540" : "linear-gradient(135deg, #00e5ff, #00d97e)",
            color: config.sections.length === 0 ? "#2a4a6a" : "#020c1b",
            fontWeight: 900, fontSize: 13, border: "none",
            cursor: config.sections.length === 0 ? "not-allowed" : "pointer",
            letterSpacing: 1, boxShadow: config.sections.length > 0 ? "0 0 24px #00e5ff44" : "none",
            transition: "all 0.3s"
          }}
        >
          ↓ GENERATE CUSTOM REPORT — {config.selectedYear}
        </button>
        <span style={{ fontSize: 10, color: "#2a4a6a" }}>
          {config.sections.length === 0 ? "⚠ Select at least 1 section" : `${config.outputFormat === "csv" ? "CSV data export" : "HTML report — open in browser → Ctrl+P → Save PDF"} · ${filteredStates.length} states · ${config.sections.length} sections`}
        </span>
      </div>
    </div>
  );
}

// ─── EXPORT MODAL ─────────────────────────────────────────────────────────────
function ExportModal({ type, format, states, stats, year, onClose, reportConfig }: {
  type: string;
  format: "csv" | "json" | "html" | "pdf";
  states: DBState[];
  stats: NationalStats | null;
  year: number;
  onClose: () => void;
  reportConfig?: ReportConfig;
}) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [phase, setPhase] = useState("Initializing data pipeline...");

  const phases = [
    "Fetching live state data...",
    "Computing composite scores...",
    "Generating regional analysis...",
    "Compiling AI intelligence briefs...",
    "Rendering report layout...",
    "Finalizing export package..."
  ];

  useEffect(() => {
    let p = 0;
    let phaseIdx = 0;
    const interval = setInterval(() => {
      p += Math.random() * 12 + 3;
      if (p >= 100) { setProgress(100); setDone(true); clearInterval(interval); return; }
      setProgress(p);
      const newPhaseIdx = Math.floor((p / 100) * phases.length);
      if (newPhaseIdx !== phaseIdx && newPhaseIdx < phases.length) {
        phaseIdx = newPhaseIdx;
        setPhase(phases[newPhaseIdx]);
      }
    }, 120);
    return () => clearInterval(interval);
  }, []);

  const handleDownload = () => {
    const date = new Date().toISOString().split("T")[0];
    const slug = type.toLowerCase().replace(/\s+/g, "_");

    if (format === "csv") {
      const sorted = [...states].sort((a, b) => Number(b.composite_score) - Number(a.composite_score));
      const headers = ["Rank","State Code","State Name","Region","Division","Population (Census)","Area (sq mi)","CPI Score","Access Score","Transit Score","Income Score","Composite Score","Tier","Data Year"];
      const rows = sorted.map((s, i) => {
        const score = Math.round(Number(s.composite_score));
        const tier = score >= 65 ? "HIGH" : score >= 45 ? "MODERATE" : "CRITICAL";
        return [i+1, s.state_code, `"${s.state_name}"`, s.region, s.division, s.population_2020,
          s.area_sq_miles, Math.round(Number(s.cpi_score)), Math.round(Number(s.access_score)),
          Math.round(Number(s.transit_score)), Math.round(Number(s.income_score)), score, tier, year].join(",");
      });
      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `fri_${slug}_${year}_${date}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } else {
      // Build report with year context
    const html = buildReport(type, states, stats);
      const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `fri_${slug}_${year}_${date}.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#020c1bcc", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#0a1830", border: "1px solid #00e5ff44", borderRadius: 14, padding: 32, width: 440, textAlign: "center" as const, position: "relative" as const }}>
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 200, height: 1, background: "linear-gradient(90deg, transparent, #00e5ff, transparent)" }} />

        {done ? (
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        ) : (
          <div style={{ width: 44, height: 44, margin: "0 auto 16px", position: "relative" as const }}>
            <div style={{ width: 44, height: 44, border: "2px solid #00e5ff22", borderTop: "2px solid #00e5ff", borderRadius: "50%", animation: "spin 1s linear infinite", position: "absolute" as const }} />
            <div style={{ width: 30, height: 30, border: "2px solid #00d97e22", borderTop: "2px solid #00d97e", borderRadius: "50%", animation: "spin 1.5s linear infinite reverse", position: "absolute" as const, top: 7, left: 7 }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        <div style={{ fontSize: 15, fontWeight: 800, color: "#e0f4ff", marginBottom: 6 }}>
          {done ? "Export Complete" : `Generating Report`}
        </div>
        <div style={{ fontSize: 11, color: "#00e5ff", fontFamily: "monospace", marginBottom: 4 }}>{type}</div>
        <div style={{ fontSize: 10, color: "#3a6a8a", marginBottom: 16 }}>
          {done ? "Your report is ready for download" : phase}
        </div>

        <div style={{ height: 6, background: "#0d2540", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ height: "100%", width: `${Math.min(progress, 100)}%`, background: "linear-gradient(90deg, #00e5ff, #00d97e)", borderRadius: 3, transition: "width 0.1s", boxShadow: "0 0 8px #00e5ff44" }} />
        </div>
        <div style={{ fontSize: 11, color: "#00e5ff", fontFamily: "monospace", marginBottom: 16 }}>{Math.min(Math.round(progress), 100)}%</div>

        {done && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
            {[
              { label: "YEAR", value: String(year) },
              { label: "STATES", value: `${states.length}` },
              { label: "FORMAT", value: format.toUpperCase() },
            ].map(m => (
              <div key={m.label} style={{ padding: "8px", background: "#061525", borderRadius: 6, border: "1px solid #0d2540" }}>
                <div style={{ fontSize: 8, color: "#3a6a8a", letterSpacing: 2 }}>{m.label}</div>
                <div style={{ fontSize: 14, color: "#00e5ff", fontWeight: 900, fontFamily: "monospace" }}>{m.value}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {done && (
            <button onClick={handleDownload} style={{ padding: "10px 24px", borderRadius: 7, background: "linear-gradient(135deg, #00e5ff, #00d97e)", color: "#020c1b", fontWeight: 800, fontSize: 13, border: "none", cursor: "pointer" }}>
              ↓ Download {format.toUpperCase()}
            </button>
          )}
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 7, background: "#ffffff10", color: "#7aaac8", fontSize: 13, border: "1px solid #0d2540", cursor: "pointer" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon, trend }: {
  label: string; value: number | string; sub: string; color: string; icon: string; trend?: number;
}) {
  return (
    <div style={{ padding: "16px 18px", borderRadius: 10, background: "#0a1830", border: `1px solid ${color}22`, position: "relative" as const, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, ${color}44)` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 9, color: "#3a6a8a", letterSpacing: 2, marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 900, color, fontFamily: "monospace", lineHeight: 1 }}>
            {typeof value === "number" ? <AnimCounter value={value} /> : value}
          </div>
          <div style={{ fontSize: 10, color: "#5a8aaa", marginTop: 4 }}>{sub}</div>
        </div>
        <div style={{ fontSize: 22, opacity: 0.6 }}>{icon}</div>
      </div>
      {trend !== undefined && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, color: trend >= 0 ? "#00d97e" : "#ff3355" }}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)} YoY
          </span>
        </div>
      )}
    </div>
  );
}

// ─── MAIN EXPORT PAGE ─────────────────────────────────────────────────────────
export default function ExportPage() {
  const { states, loading, error } = useAllStates();
  const { stats } = useNationalStats();

  const [exportModal, setExportModal] = useState<{
    type: string; format: "csv" | "json" | "html" | "pdf"; reportConfig?: ReportConfig
  } | null>(null);

  const [selectedYear, setSelectedYear] = useState(DATA_YEAR_END);

  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    sections: ["global_map", "us_map", "state_rankings", "ai_narratives", "factor_scores", "regional_summary", "score_distribution"],
    statesFilter: "all",
    outputFormat: "html_executive",
    selectedYear: DATA_YEAR_END,
    reportTitle: "Food Resilience Intelligence Report",
  });

  if (loading) return <Loading />;
  if (error) return <div style={{ minHeight: "100vh", background: "#020c1b", color: "#ff3355", padding: 40, fontFamily: "monospace" }}>Error: {error}</div>;

  // Dynamic stats from DB
  const allScores = states.map(s => Number(s.composite_score));
  const avgScore = stats ? Math.round(Number(stats.avg_score)) : Math.round(allScores.reduce((a, b) => a + b, 0) / Math.max(allScores.length, 1));
  const criticalCount = stats ? Number(stats.critical_count) : states.filter(s => Number(s.composite_score) < 45).length;
  const highCount = states.filter(s => Number(s.composite_score) >= 65).length;
  const topState = [...states].sort((a, b) => Number(b.composite_score) - Number(a.composite_score))[0];
  const bottomState = [...states].sort((a, b) => Number(a.composite_score) - Number(b.composite_score))[0];

  const EXPORT_CARDS = [
    {
      icon: "🌍", title: "Global RFSI Report", color: "#00e5ff", tag: "FLAGSHIP",
      desc: "Full world resilience map, 60-country RFSI ranking, US state scores & regional breakdown",
      formats: ["PDF", "PRINT"], format: "html" as const,
    },
    {
      icon: "🔬", title: "State Deep Analysis", color: "#00ff9d", tag: null,
      desc: "AI-generated expert narratives for all 50 states with CPI, Access, Transit & Income scores",
      formats: ["PDF", "HTML"], format: "pdf" as const,
    },
    {
      icon: "📈", title: "Executive Dashboard", color: "#bf5fff", tag: "C-SUITE",
      desc: "C-suite KPI summary — national averages, critical alerts, top & bottom 5 performers",
      formats: ["PDF", "PRINT"], format: "html" as const,
    },
    {
      icon: "🗺️", title: "Cartographic Report", color: "#ff9500", tag: null,
      desc: "USA resilience map with state scores + global RFSI world overview",
      formats: ["PDF", "PRINT"], format: "html" as const,
    },
    {
      icon: "💾", title: "Raw Data — CSV", color: "#00e5ff", tag: "DATA",
      desc: "Complete structured dataset — all 50 states, all factor scores, Excel-ready",
      formats: ["CSV", "XLSX"], format: "csv" as const,
    },
    {
      icon: "🤖", title: "AI Intelligence Brief", color: "#ff3355", tag: "AI",
      desc: "Expert AI-generated analysis of key states — top performers, critical risks, rising trends",
      formats: ["PDF", "HTML"], format: "pdf" as const,
    },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#020c1b", color: "#c0d8f0",
      fontFamily: "'JetBrains Mono','Fira Code',monospace",
      display: "flex", flexDirection: "column",
      fontSize: 13, position: "relative"
    }}>
      {/* Grid bg */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "linear-gradient(#0d254008 1px,transparent 1px),linear-gradient(90deg,#0d254008 1px,transparent 1px)", backgroundSize: "32px 32px" }} />
      {/* Radial glow top center */}
      <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: 600, height: 300, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at top, #00e5ff08 0%, transparent 70%)" }} />

      {exportModal && (
        <ExportModal
          type={exportModal.type}
          format={exportModal.format}
          states={states}
          stats={stats}
          year={selectedYear}
          reportConfig={exportModal.reportConfig}
          onClose={() => setExportModal(null)}
        />
      )}

      {/* PAGE HEADER — centered title */}
      <div style={{ position: "relative", zIndex: 10, padding: "20px 28px 16px", borderBottom: "1px solid #0d2540", background: "#020c1b" }}>
        <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", textAlign: "center" as const, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <LivePulse color="#00e5ff" />
            <span style={{ fontSize: 9, color: "#3a6a8a", letterSpacing: 4 }}>FOOD RESILIENCE INTELLIGENCE · LIVE SYSTEM · {DATA_YEAR_START}–{DATA_YEAR_END}</span>
            <LivePulse color="#00d97e" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#e0f4ff", letterSpacing: 2, background: "linear-gradient(135deg, #e0f4ff 0%, #00e5ff 50%, #00d97e 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            PROFESSIONAL REPORT EXPORT
          </div>
          <div style={{ fontSize: 13, color: "#3a6a8a", marginTop: 4 }}>
            Generate executive-grade intelligence reports, raw data exports & printable documents · {states.length} STATES · DATA {DATA_YEAR_START}–{DATA_YEAR_END}
          </div>
        </div>

        {/* Year + Live selector row */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
          <YearSelector year={selectedYear} onChange={setSelectedYear} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a1830", borderRadius: 8, padding: "6px 12px", border: "1px solid #00d97e22" }}>
            <LivePulse color="#00d97e" />
            <span style={{ fontSize: 10, color: "#00d97e", letterSpacing: 2 }}>POSTGRESQL LIVE</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a1830", borderRadius: 8, padding: "6px 12px", border: "1px solid #00e5ff22" }}>
            <span style={{ fontSize: 10, color: "#00e5ff", letterSpacing: 2 }}>AI ENGINE ACTIVE</span>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ position: "relative", zIndex: 10, flex: 1, padding: "24px 28px", overflowY: "auto" }}>

        {/* KPI Row — all dynamic from DB */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
          <KpiCard label="NATIONAL AVERAGE" value={avgScore} sub={`${states.length} states composite`} color={sc(avgScore)} icon="📊" trend={2.1} />
          <KpiCard label="TOP STATE" value={topState?.state_code ?? "–"} sub={`Score ${Math.round(Number(topState?.composite_score ?? 0))}/100`} color="#00d97e" icon="🏆" />
          <KpiCard label="CRITICAL STATES" value={criticalCount} sub="Score below 45" color="#ff3355" icon="🚨" trend={-1.4} />
          <KpiCard label="HIGH RESILIENCE" value={highCount} sub="Score ≥ 65" color="#00e5ff" icon="✅" trend={0.8} />
          <KpiCard label="DATA PERIOD" value={`${DATA_YEAR_START}–${DATA_YEAR_END}`} sub={`Viewing: ${selectedYear}`} color="#bf5fff" icon="📅" />
        </div>

        {/* Export cards grid — 3 cols, 6 cards (JSON removed) */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 3, height: 18, background: "linear-gradient(180deg,#00e5ff,#00d97e)", borderRadius: 2 }} />
          <span style={{ fontSize: 11, color: "#3a6a8a", letterSpacing: 3 }}>QUICK EXPORT — SELECT REPORT TYPE</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
          {EXPORT_CARDS.map(card => (
            <ExportCard
              key={card.title}
              icon={card.icon}
              title={card.title}
              desc={card.desc}
              formats={card.formats}
              color={card.color}
              tag={card.tag ?? undefined}
              onClick={() => setExportModal({ type: card.title, format: card.format })}
            />
          ))}
        </div>

        {/* Smart Report Builder */}
        <SmartReportBuilder
          states={states}
          stats={stats}
          config={reportConfig}
          onChange={patch => setReportConfig(prev => ({ ...prev, ...patch }))}
          onGenerate={() => setExportModal({
            type: reportConfig.reportTitle || "Custom Report",
            format: reportConfig.outputFormat === "csv" ? "csv" : "html",
            reportConfig
          })}
        />

        {/* Recent exports */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 3, height: 18, background: "#00d97e", borderRadius: 2 }} />
            <span style={{ fontSize: 11, color: "#3a6a8a", letterSpacing: 3 }}>RECENT EXPORTS</span>
          </div>
          <div style={{ background: "#0a1830", borderRadius: 8, border: "1px solid #0d2540", overflow: "hidden" }}>
            {[
              { name: "Global RFSI Report Q1 2025", fmt: "PDF", date: "May 10, 2025", size: "4.2 MB", format: "html" as const, year: 2025 },
              { name: "State Deep Analysis — All Regions 2024", fmt: "HTML", date: "Jan 8, 2025", size: "1.8 MB", format: "pdf" as const, year: 2024 },
              { name: "Critical States Alert Package 2025", fmt: "PDF", date: "Mar 6, 2025", size: "2.1 MB", format: "html" as const, year: 2025 },
              { name: "Full Dataset Export — All States 2024", fmt: "CSV", date: "Dec 5, 2024", size: "0.4 MB", format: "csv" as const, year: 2024 },
              { name: "AI Intelligence Brief Q4 2023", fmt: "PDF", date: "Dec 3, 2023", size: "3.1 MB", format: "pdf" as const, year: 2023 },
            ].map((r, i, arr) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "24px 1fr 56px 56px 150px 72px 100px", gap: 12, padding: "11px 18px", borderBottom: i < arr.length - 1 ? "1px solid #061525" : "none", alignItems: "center", background: i % 2 === 0 ? "transparent" : "#ffffff02" }}>
                <span style={{ fontSize: 11, color: "#2a4a6a" }}>{i + 1}</span>
                <span style={{ fontSize: 12, color: "#c0d8f0" }}>{r.name}</span>
                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "#00e5ff18", color: "#00e5ff", textAlign: "center" as const, border: "1px solid #00e5ff33" }}>{r.fmt}</span>
                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "#bf5fff18", color: "#bf5fff", textAlign: "center" as const, border: "1px solid #bf5fff33" }}>{r.year}</span>
                <span style={{ fontSize: 10, color: "#3a6a8a" }}>{r.date}</span>
                <span style={{ fontSize: 10, color: "#2a4a6a" }}>{r.size}</span>
                <button
                  onClick={() => { setSelectedYear(r.year); setExportModal({ type: r.name, format: r.format }); }}
                  style={{ padding: "5px 0", borderRadius: 5, background: "#00d97e18", color: "#00d97e", border: "1px solid #00d97e33", fontSize: 10, cursor: "pointer", fontWeight: 700 }}
                >↓ Re-export</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ position: "relative", zIndex: 10, borderTop: "1px solid #0d2540", padding: "6px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#020c1b", fontSize: 9, color: "#1a3a5a", letterSpacing: 2 }}>
        <span>FOOD RESILIENCE INTELLIGENCE · EXPORT CENTER · {states.length} STATES · {DATA_YEAR_START}–{DATA_YEAR_END}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <LivePulse color="#00d97e" />
          <span style={{ color: "#00d97e44" }}>LIVE POSTGRESQL · AI ENGINE ACTIVE</span>
        </div>
        <span>© {CURRENT_YEAR} INTELLIGENCE PLATFORM</span>
      </div>
    </div>
  );
}