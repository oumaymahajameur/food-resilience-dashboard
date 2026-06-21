  "use client";

  import { useEffect, useRef, useState, useCallback } from "react";
  import * as d3 from "d3";
  import { feature } from "topojson-client";
  import {
    useAllStates,
    useStateTrends,
    useNationalStats,
  } from "@/hooks/StatesData";

  const STATE_POPULATION: Record<string, number> = {
    "Alabama": 5024279, "Alaska": 733391, "Arizona": 7151502, "Arkansas": 3011524,
    "California": 39538223, "Colorado": 5773714, "Connecticut": 3605944, "Delaware": 989948,
    "Florida": 21538187, "Georgia": 10711908, "Hawaii": 1455271, "Idaho": 1839106,
    "Illinois": 12812508, "Indiana": 6785528, "Iowa": 3190369, "Kansas": 2937880,
    "Kentucky": 4505836, "Louisiana": 4657757, "Maine": 1362359, "Maryland": 6177224,
    "Massachusetts": 7029917, "Michigan": 10077331, "Minnesota": 5706494, "Mississippi": 2961279,
    "Missouri": 6154913, "Montana": 1084225, "Nebraska": 1961504, "Nevada": 3104614,
    "New Hampshire": 1377529, "New Jersey": 9288994, "New Mexico": 2117522, "New York": 20201249,
    "North Carolina": 10439388, "North Dakota": 779094, "Ohio": 11799448, "Oklahoma": 3959353,
    "Oregon": 4237256, "Pennsylvania": 13002700, "Rhode Island": 1097379, "South Carolina": 5118425,
    "South Dakota": 886667, "Tennessee": 6910840, "Texas": 29145505, "Utah": 3271616,
    "Vermont": 643077, "Virginia": 8631393, "Washington": 7705281, "West Virginia": 1793716,
    "Wisconsin": 5893718, "Wyoming": 576851,
  };

  const STATE_AREA: Record<string, number> = {
    "Alabama": 52420, "Alaska": 663268, "Arizona": 113990, "Arkansas": 53179,
    "California": 163696, "Colorado": 104094, "Connecticut": 5543, "Delaware": 2489,
    "Florida": 65758, "Georgia": 59425, "Hawaii": 10932, "Idaho": 83569,
    "Illinois": 57914, "Indiana": 36420, "Iowa": 56273, "Kansas": 82278,
    "Kentucky": 40408, "Louisiana": 52378, "Maine": 35380, "Maryland": 12407,
    "Massachusetts": 10554, "Michigan": 96714, "Minnesota": 86936, "Mississippi": 48432,
    "Missouri": 69707, "Montana": 147040, "Nebraska": 77358, "Nevada": 110572,
    "New Hampshire": 9349, "New Jersey": 8723, "New Mexico": 121590, "New York": 54555,
    "North Carolina": 53819, "North Dakota": 70698, "Ohio": 44826, "Oklahoma": 69899,
    "Oregon": 98379, "Pennsylvania": 46054, "Rhode Island": 1545, "South Carolina": 32020,
    "South Dakota": 77116, "Tennessee": 42144, "Texas": 268596, "Utah": 84897,
    "Vermont": 9616, "Virginia": 42775, "Washington": 71298, "West Virginia": 24230,
    "Wisconsin": 65496, "Wyoming": 97813,
  };

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

  const YEARS = ["2015","2016","2017","2018","2019","2020","2021","2022","2023","2024","2025"];

  const FACTOR_META = [
    { key: "cpi_score",     label: "CPI",     full: "Price / CPI Pressure",  color: "#00e5ff", weight: 0.30 },
    { key: "access_score",  label: "ACCESS",  full: "Food Accessibility",    color: "#00ff9d", weight: 0.30 },
    { key: "transit_score", label: "TRANSIT", full: "Transit Density",       color: "#ff9500", weight: 0.20 },
    { key: "income_score",  label: "INCOME",  full: "Income Stability",      color: "#bf5fff", weight: 0.20 },
  ] as const;

  function scoreTier(score: number): { label: string; color: string; bg: string } {
    if (score >= 65) return { label: "HIGH",     color: "#00d97e", bg: "#00d97e18" };
    if (score >= 45) return { label: "MODERATE", color: "#ff9500", bg: "#ff950018" };
    return              { label: "CRITICAL",  color: "#ff3355", bg: "#ff335518" };
  }
  function scoreColor(score: number): string { return scoreTier(score).color; }

  function generateYearlyTrend(base: number, volatility = 6): number[] {
    let val = Math.max(20, Math.min(90, base - 12));
    return YEARS.map(() => {
      const drift = (base - val) * 0.15;
      val = Math.max(15, Math.min(100, val + drift + (Math.random() - 0.4) * volatility));
      return Math.round(val);
    });
  }

  // ─── SPARKLINE ────────────────────────────────────────────────────────────────
  function Sparkline({ data, color, height = 36, width = 110 }: {
    data: number[]; color: string; height?: number; width?: number;
  }) {
    const ref = useRef<SVGSVGElement>(null);
    useEffect(() => {
      if (!ref.current || !data.length) return;
      const svg = d3.select(ref.current);
      svg.selectAll("*").remove();
      const xS = d3.scaleLinear().domain([0, data.length - 1]).range([0, width]);
      const yS = d3.scaleLinear().domain([0, 100]).range([height - 2, 2]);
      const line = d3.line<number>().x((_, i) => xS(i)).y(d => yS(d)).curve(d3.curveCatmullRom);
      const area = d3.area<number>().x((_, i) => xS(i)).y0(height).y1(d => yS(d)).curve(d3.curveCatmullRom);
      const gid = `sp${Math.random().toString(36).slice(2)}`;
      const defs = svg.append("defs");
      const grad = defs.append("linearGradient").attr("id", gid).attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",1);
      grad.append("stop").attr("offset","0%").attr("stop-color",color).attr("stop-opacity",0.35);
      grad.append("stop").attr("offset","100%").attr("stop-color",color).attr("stop-opacity",0);
      svg.append("path").datum(data).attr("d", area).attr("fill", `url(#${gid})`);
      svg.append("path").datum(data).attr("d", line).attr("fill","none").attr("stroke",color).attr("stroke-width",1.5);
      const last = data[data.length - 1];
      svg.append("circle").attr("cx",xS(data.length-1)).attr("cy",yS(last)).attr("r",2.5).attr("fill",color);
    }, [data, color, height, width]);
    return <svg ref={ref} width={width} height={height} style={{ overflow: "visible" }} />;
  }

  // ─── MINI BAR ─────────────────────────────────────────────────────────────────
  function MiniBar({ value, color, max = 100 }: { value: number; color: string; max?: number }) {
    const pct = Math.min(100, (value / max) * 100);
    return (
      <div style={{ height: 5, background: "#ffffff0d", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
      </div>
    );
  }

  // ─── RADIAL GAUGE ─────────────────────────────────────────────────────────────
  function RadialGauge({ value, color, size = 72 }: { value: number; color: string; size?: number }) {
    const r = size / 2 - 7;
    const circ = 2 * Math.PI * r;
    const dash = (value / 100) * circ;
    return (
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ffffff08" strokeWidth={7} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 800, color, fontFamily: "monospace" }}>{value}</div>
      </div>
    );
  }

  // ─── SCORE BADGE ──────────────────────────────────────────────────────────────
  function ScoreBadge({ score }: { score: number }) {
    const tier = scoreTier(score);
    return (
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: tier.color,
        background: tier.bg, border: `1px solid ${tier.color}44`, borderRadius: 3,
        padding: "2px 7px", textTransform: "uppercase" as const }}>{tier.label}</span>
    );
  }

  // ─── DONUT KPI ────────────────────────────────────────────────────────────────
  function DonutKPI({ value, color, label, sub }: { value: number; color: string; label: string; sub?: string }) {
    const size = 70, r = 28, circ = 2 * Math.PI * r;
    const dash = (value / 100) * circ;
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
        <div style={{ position:"relative", width:size, height:size }}>
          <svg width={size} height={size} style={{ transform:"rotate(-90deg)", position:"absolute" }}>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ffffff08" strokeWidth={6} />
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
          </svg>
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:15, fontWeight:900, color, fontFamily:"monospace" }}>{value}</span>
          </div>
        </div>
        <div style={{ fontSize:10, color:"#5a8aaa", letterSpacing:1, textAlign:"center" }}>{label}</div>
        {sub && <div style={{ fontSize:9, color:"#2a4a6a" }}>{sub}</div>}
      </div>
    );
  }

  // ─── GAUGE CLUSTER ────────────────────────────────────────────────────────────
  function GaugeCluster({ state }: { state: DBState }) {
    return (
      <div>
        <div style={{ fontSize:11, color:"#3a6a8a", letterSpacing:3, marginBottom:10 }}>FACTOR GAUGES</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <DonutKPI value={Math.round(Number(state.cpi_score))}     color="#00e5ff" label="CPI"     sub="Price Pressure" />
          <DonutKPI value={Math.round(Number(state.access_score))}  color="#00ff9d" label="ACCESS"  sub="Food Access" />
          <DonutKPI value={Math.round(Number(state.transit_score))} color="#ff9500" label="TRANSIT" sub="Density" />
          <DonutKPI value={Math.round(Number(state.income_score))}  color="#bf5fff" label="INCOME"  sub="Stability" />
        </div>
      </div>
    );
  }

  // ─── RADAR CHART (Spider) ─────────────────────────────────────────────────────
  function RadarChart({ state, states }: { state: DBState; states: DBState[] }) {
    const ref = useRef<SVGSVGElement>(null);
    const W = 260, H = 200;
    const cx = W / 2, cy = H / 2 + 10;
    const R = 72;

    useEffect(() => {
      if (!ref.current) return;
      const svg = d3.select(ref.current);
      svg.selectAll("*").remove();

      const factors = [
        { label: "CPI",     value: Math.round(Number(state.cpi_score)),     color: "#00e5ff" },
        { label: "ACCESS",  value: Math.round(Number(state.access_score)),  color: "#00ff9d" },
        { label: "TRANSIT", value: Math.round(Number(state.transit_score)), color: "#ff9500" },
        { label: "INCOME",  value: Math.round(Number(state.income_score)),  color: "#bf5fff" },
      ];
      const n = factors.length;

      // National averages
      const natAvg = factors.map(f => {
        const key = f.label === "CPI" ? "cpi_score" : f.label === "ACCESS" ? "access_score" : f.label === "TRANSIT" ? "transit_score" : "income_score";
        return Math.round(states.reduce((a, s) => a + Number(s[key as keyof DBState] ?? 50), 0) / Math.max(states.length, 1));
      });

      const angleFor = (i: number) => (i / n) * 2 * Math.PI - Math.PI / 2;
      const pointFor = (val: number, i: number, radius = R) => {
        const a = angleFor(i);
        const r = (val / 100) * radius;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      };

      // Grid rings
      [25, 50, 75, 100].forEach(v => {
        const pts = factors.map((_, i) => pointFor(v, i));
        svg.append("polygon")
          .attr("points", pts.map(p => p.join(",")).join(" "))
          .attr("fill", "none").attr("stroke", "#0d2540").attr("stroke-width", 1);
      });

      // Axes
      factors.forEach((_, i) => {
        const [x2, y2] = pointFor(100, i);
        svg.append("line").attr("x1", cx).attr("y1", cy).attr("x2", x2).attr("y2", y2)
          .attr("stroke", "#0d2540").attr("stroke-width", 1);
      });

      // National avg polygon
      const avgPts = natAvg.map((v, i) => pointFor(v, i));
      svg.append("polygon")
        .attr("points", avgPts.map(p => p.join(",")).join(" "))
        .attr("fill", "#ffffff08").attr("stroke", "#ffffff22").attr("stroke-width", 1.5).attr("stroke-dasharray", "4 3");

      // State polygon
      const statePts = factors.map((f, i) => pointFor(f.value, i));
      const defs = svg.append("defs");
      const gid = "radar_fill";
      const grad = defs.append("radialGradient").attr("id", gid);
      grad.append("stop").attr("offset", "0%").attr("stop-color", "#00e5ff").attr("stop-opacity", 0.3);
      grad.append("stop").attr("offset", "100%").attr("stop-color", "#00e5ff").attr("stop-opacity", 0.05);

      svg.append("polygon")
        .attr("points", statePts.map(p => p.join(",")).join(" "))
        .attr("fill", `url(#${gid})`).attr("stroke", "#00e5ff").attr("stroke-width", 2);

      // Dots + labels
      factors.forEach((f, i) => {
        const [x, y] = pointFor(f.value, i);
        svg.append("circle").attr("cx", x).attr("cy", y).attr("r", 4)
          .attr("fill", f.color).attr("stroke", "#020c1b").attr("stroke-width", 1.5);

        const [lx, ly] = pointFor(115, i);
        svg.append("text").attr("x", lx).attr("y", ly).attr("text-anchor", "middle")
          .attr("dominant-baseline", "central").attr("fill", f.color)
          .attr("font-size", 9).attr("font-weight", 700).attr("font-family", "monospace")
          .text(f.label);
      });

      // Center label
      svg.append("text").attr("x", cx).attr("y", cy - 4).attr("text-anchor", "middle")
        .attr("fill", "#3a6a8a").attr("font-size", 8).attr("font-family", "monospace").text("VS NAT. AVG");
    }, [state, states]);

    return (
      <div>
        <div style={{ fontSize: 11, color: "#3a6a8a", letterSpacing: 3, marginBottom: 6 }}>RADAR PROFILE</div>
        <svg ref={ref} width="100%" viewBox={`0 0 ${W} ${H}`} />
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 20, height: 2, background: "#00e5ff", borderRadius: 1 }} />
            <span style={{ fontSize: 9, color: "#5a8aaa" }}>STATE</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 20, height: 2, background: "#ffffff33", borderRadius: 1, borderTop: "1px dashed #ffffff44" }} />
            <span style={{ fontSize: 9, color: "#5a8aaa" }}>NAT. AVG</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── DIVERGING BAR (vs national avg) ──────────────────────────────────────────
  function DivergingBar({ state, states }: { state: DBState; states: DBState[] }) {
    const ref = useRef<SVGSVGElement>(null);
    const W = 260, H = 110;

    useEffect(() => {
      if (!ref.current || !states.length) return;
      const svg = d3.select(ref.current);
      svg.selectAll("*").remove();

      const factors = [
        { label: "CPI",     key: "cpi_score",     color: "#00e5ff" },
        { label: "ACCESS",  key: "access_score",  color: "#00ff9d" },
        { label: "TRANSIT", key: "transit_score", color: "#ff9500" },
        { label: "INCOME",  key: "income_score",  color: "#bf5fff" },
      ];

      const bars = factors.map(f => {
        const stateVal = Math.round(Number(state[f.key as keyof DBState] ?? 50));
        const natAvg = Math.round(states.reduce((a, s) => a + Number(s[f.key as keyof DBState] ?? 50), 0) / Math.max(states.length, 1));
        return { label: f.label, color: f.color, diff: stateVal - natAvg, stateVal, natAvg };
      });

      const m = { top: 6, right: 10, bottom: 6, left: 52 };
      const iW = W - m.left - m.right;
      const iH = H - m.top - m.bottom;
      const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

      const maxAbs = Math.max(30, ...bars.map(b => Math.abs(b.diff)));
      const xS = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([0, iW]);
      const yS = d3.scaleBand().domain(bars.map(b => b.label)).range([0, iH]).padding(0.35);
      const mid = xS(0);

      // Center line
      g.append("line").attr("x1", mid).attr("x2", mid).attr("y1", 0).attr("y2", iH)
        .attr("stroke", "#ffffff22").attr("stroke-width", 1);

      // Grid
      [-20, -10, 10, 20].forEach(v => {
        if (Math.abs(v) <= maxAbs) {
          g.append("line").attr("x1", xS(v)).attr("x2", xS(v)).attr("y1", 0).attr("y2", iH)
            .attr("stroke", "#ffffff06").attr("stroke-width", 1);
        }
      });

      bars.forEach(b => {
        const y = yS(b.label) ?? 0;
        const bh = yS.bandwidth();
        const x1 = b.diff >= 0 ? mid : xS(b.diff);
        const bw = Math.abs(xS(b.diff) - mid);

        // Bar
        g.append("rect").attr("x", x1).attr("y", y).attr("width", Math.max(bw, 2)).attr("height", bh)
          .attr("fill", b.diff >= 0 ? b.color : "#ff3355").attr("opacity", 0.75).attr("rx", 2);

        // Top cap
        g.append("rect").attr("x", x1).attr("y", y).attr("width", Math.max(bw, 2)).attr("height", 2)
          .attr("fill", b.diff >= 0 ? b.color : "#ff3355").attr("rx", 1);

        // Label left
        g.append("text").attr("x", -6).attr("y", y + bh / 2).attr("text-anchor", "end")
          .attr("dominant-baseline", "central").attr("fill", b.color)
          .attr("font-size", 9).attr("font-weight", 700).attr("font-family", "monospace").text(b.label);

        // Value label
        const valX = b.diff >= 0 ? x1 + bw + 4 : x1 - 4;
        g.append("text").attr("x", valX).attr("y", y + bh / 2).attr("text-anchor", b.diff >= 0 ? "start" : "end")
          .attr("dominant-baseline", "central").attr("fill", b.diff >= 0 ? b.color : "#ff3355")
          .attr("font-size", 9).attr("font-weight", 800).attr("font-family", "monospace")
          .text(`${b.diff >= 0 ? "+" : ""}${b.diff}`);
      });
    }, [state, states]);

    return (
      <div>
        <div style={{ fontSize: 11, color: "#3a6a8a", letterSpacing: 3, marginBottom: 6 }}>VS NATIONAL AVG</div>
        <svg ref={ref} width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" />
      </div>
    );
  }

  // ─── TREND VELOCITY ───────────────────────────────────────────────────────────
  function TrendVelocity({ trends }: {
    trends: { label: string; color: string; data: number[] }[];
  }) {
    // velocity = last 3yr avg change per year
    const velocities = trends.map(t => {
      const n = t.data.length;
      if (n < 4) return { label: t.label, color: t.color, v: 0 };
      const recent = t.data.slice(-3);
      const v = (recent[recent.length - 1] - recent[0]) / (recent.length - 1);
      return { label: t.label, color: t.color, v: parseFloat(v.toFixed(1)) };
    });

    return (
      <div>
        <div style={{ fontSize: 11, color: "#3a6a8a", letterSpacing: 3, marginBottom: 8 }}>TREND VELOCITY</div>
        <div style={{ fontSize: 9, color: "#2a4a6a", marginBottom: 8 }}>3-YEAR MOMENTUM (PTS/YR)</div>
        {velocities.map(v => (
          <div key={v.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <span style={{ fontSize: 9, color: v.color, fontWeight: 700, width: 50, letterSpacing: 1 }}>{v.label}</span>
            <div style={{ flex: 1, height: 6, background: "#ffffff0a", borderRadius: 3, overflow: "hidden", position: "relative" }}>
              <div style={{
                position: "absolute",
                left: v.v >= 0 ? "50%" : `${Math.max(0, 50 + (v.v / 10) * 50)}%`,
                width: `${Math.min(50, Math.abs(v.v / 10) * 50)}%`,
                height: "100%",
                background: v.v >= 0 ? v.color : "#ff3355",
                borderRadius: 3,
                transition: "all 0.6s ease",
              }} />
              <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "#ffffff22" }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 900, color: v.v >= 0 ? v.color : "#ff3355", fontFamily: "monospace", width: 36, textAlign: "right" }}>
              {v.v >= 0 ? "+" : ""}{v.v}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // ─── VERTICAL BAR CHART (replaces MountainLineChart) ─────────────────────────
  function VerticalBarChart({ datasets, title, height = 175, width = 580 }: {
    datasets: { data: number[]; color: string; label: string }[];
    title?: string; height?: number; width?: number;
  }) {
    const ref = useRef<SVGSVGElement>(null);
    const [hoveredYear, setHoveredYear] = useState<number | null>(null);

    useEffect(() => {
      if (!ref.current || !datasets.length) return;
      const svg = d3.select(ref.current);
      svg.selectAll("*").remove();
      const m = { top: 24, right: 20, bottom: 32, left: 36 };
      const iW = width - m.left - m.right;
      const iH = height - m.top - m.bottom;
      const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
      const n = YEARS.length;
      const groupW = iW / n;
      const barW = Math.max(3, (groupW - 6) / datasets.length - 1);
      const yS = d3.scaleLinear().domain([0, 110]).range([iH, 0]);
      const defs = svg.append("defs");

      // Grid lines
      [25, 50, 75, 100].forEach(t => {
        g.append("line").attr("x1", 0).attr("x2", iW).attr("y1", yS(t)).attr("y2", yS(t))
          .attr("stroke", "#ffffff09").attr("stroke-dasharray", "4 8");
        g.append("text").attr("x", -8).attr("y", yS(t) + 4).attr("text-anchor", "end")
          .attr("fill", "#2a4a6a").attr("font-size", 9).attr("font-family", "monospace").text(t);
      });

      // Hover highlight background
      if (hoveredYear !== null) {
        g.append("rect")
          .attr("x", hoveredYear * groupW)
          .attr("y", 0)
          .attr("width", groupW)
          .attr("height", iH)
          .attr("fill", "#ffffff05")
          .attr("rx", 2);
        g.append("line")
          .attr("x1", hoveredYear * groupW + groupW / 2)
          .attr("x2", hoveredYear * groupW + groupW / 2)
          .attr("y1", 0).attr("y2", iH)
          .attr("stroke", "#ffffff18").attr("stroke-width", 1).attr("stroke-dasharray", "3 4");
      }

      // Bars
      datasets.forEach(({ data, color, label }, di) => {
        const gid = `vb_${di}`;
        const grad = defs.append("linearGradient").attr("id", gid).attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1);
        grad.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", hoveredYear !== null ? 0.9 : 0.85);
        grad.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 0.25);

        data.forEach((v, i) => {
          const groupX = i * groupW;
          const barOffset = di * (barW + 1) + (groupW - datasets.length * (barW + 1)) / 2;
          const bx = groupX + barOffset;
          const by = yS(v);
          const bh = iH - by;
          const isHov = hoveredYear === i;

          g.append("rect")
            .attr("x", bx).attr("y", by)
            .attr("width", barW).attr("height", Math.max(bh, 2))
            .attr("fill", `url(#${gid})`)
            .attr("rx", 2)
            .attr("opacity", hoveredYear !== null && !isHov ? 0.4 : 1);

          // Top accent line
          g.append("rect")
            .attr("x", bx).attr("y", by)
            .attr("width", barW).attr("height", 2)
            .attr("fill", color).attr("rx", 1)
            .attr("opacity", hoveredYear !== null && !isHov ? 0.4 : 1);

          // Value label on hover
          if (isHov) {
            g.append("text")
              .attr("x", bx + barW / 2).attr("y", by - 5)
              .attr("text-anchor", "middle").attr("fill", color)
              .attr("font-size", 9).attr("font-weight", 800).attr("font-family", "monospace")
              .text(v);
          }
        });
      });

      // Year labels + hover zones
      YEARS.forEach((yr, i) => {
        const gx = i * groupW + groupW / 2;
        g.append("text")
          .attr("x", gx).attr("y", iH + 18)
          .attr("text-anchor", "middle")
          .attr("fill", hoveredYear === i ? "#c0d8f0" : "#3a6a8a")
          .attr("font-size", 9).attr("font-family", "monospace").text(yr);

        svg.append("rect")
          .attr("x", m.left + i * groupW)
          .attr("y", m.top)
          .attr("width", groupW)
          .attr("height", iH)
          .attr("fill", "transparent")
          .style("cursor", "crosshair")
          .on("mouseover", () => setHoveredYear(i))
          .on("mouseout", () => setHoveredYear(null));
      });

      // Legend
      datasets.forEach(({ color, label }, i) => {
        const lx = iW - (datasets.length - 1 - i) * 85;
        g.append("rect").attr("x", lx - 36).attr("y", -18).attr("width", 12).attr("height", 8)
          .attr("fill", color).attr("opacity", 0.8).attr("rx", 2);
        g.append("text").attr("x", lx - 20).attr("y", -12).attr("fill", color)
          .attr("font-size", 9).attr("font-weight", 700).attr("font-family", "monospace").text(label);
      });

    }, [datasets, hoveredYear, height, width]);

    return (
      <div>
        {title && <div style={{ fontSize: 11, color: "#3a6a8a", letterSpacing: 3, marginBottom: 6 }}>{title}</div>}
        {hoveredYear !== null && (
          <div style={{ display: "flex", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#3a6a8a", fontFamily: "monospace" }}>◆ {YEARS[hoveredYear]}</span>
            {datasets.map(({ color, label, data }) => (
              <span key={label} style={{ fontSize: 10, color, fontFamily: "monospace", fontWeight: 700 }}>
                {label}: {data[hoveredYear]}
              </span>
            ))}
          </div>
        )}
        <svg ref={ref} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" />
      </div>
    );
  }

  // ─── 3D PIE CHART ─────────────────────────────────────────────────────────────
  function Pie3DChart({ state }: { state: DBState }) {
    const ref = useRef<SVGSVGElement>(null);
    const [hovered, setHovered] = useState<number | null>(null);
    const slices = FACTOR_META.map(f => ({
      label: f.label, full: f.full, color: f.color,
      value: Math.round(Number(state[f.key as keyof DBState] ?? 50)), weight: f.weight,
    }));
    const total = slices.reduce((a, s) => a + s.value, 0);
    useEffect(() => {
      if (!ref.current) return;
      const W = 260, H = 190, cx = W/2, cy = H/2-10, rx = 95, ry = 42, depth = 22;
      const svg = d3.select(ref.current);
      svg.selectAll("*").remove();
      const defs = svg.append("defs");
      const filter = defs.append("filter").attr("id","glow3d");
      filter.append("feGaussianBlur").attr("stdDeviation","3").attr("result","coloredBlur");
      const feMerge = filter.append("feMerge");
      feMerge.append("feMergeNode").attr("in","coloredBlur");
      feMerge.append("feMergeNode").attr("in","SourceGraphic");
      const pie = d3.pie<typeof slices[0]>().value(d=>d.value).sort(null);
      const arcs = pie(slices);
      arcs.forEach((arc,i) => {
        const midAngle = (arc.startAngle+arc.endAngle)/2;
        if (!(midAngle>0&&midAngle<Math.PI)) return;
        const outerR = rx+(hovered===i?8:0);
        const startX = Math.cos(arc.startAngle-Math.PI/2)*outerR;
        const startY = Math.sin(arc.startAngle-Math.PI/2)*ry;
        const endX = Math.cos(arc.endAngle-Math.PI/2)*outerR;
        const endY = Math.sin(arc.endAngle-Math.PI/2)*ry;
        const d = `M ${cx+startX} ${cy+startY} A ${outerR} ${ry} 0 ${arc.endAngle-arc.startAngle>Math.PI?1:0} 1 ${cx+endX} ${cy+endY} L ${cx+endX} ${cy+endY+depth} A ${outerR} ${ry} 0 ${arc.endAngle-arc.startAngle>Math.PI?1:0} 0 ${cx+startX} ${cy+startY+depth} Z`;
        svg.append("path").attr("d",d).attr("fill",arc.data.color).attr("opacity",0.35).attr("stroke","#020c1b").attr("stroke-width",0.5);
      });
      arcs.forEach((arc,i) => {
        const isHov = hovered===i;
        const outerR = rx+(isHov?10:0);
        const midAngle = (arc.startAngle+arc.endAngle)/2;
        const pullX = isHov?Math.cos(midAngle-Math.PI/2)*8:0;
        const pullY = isHov?Math.sin(midAngle-Math.PI/2)*4:0;
        const arcFn = d3.arc<d3.PieArcDatum<typeof slices[0]>>().innerRadius(28).outerRadius(outerR).startAngle(arc.startAngle).endAngle(arc.endAngle);
        const gradId = `pg3d_${i}`;
        const grad = defs.append("radialGradient").attr("id",gradId);
        grad.append("stop").attr("offset","0%").attr("stop-color",arc.data.color).attr("stop-opacity",1);
        grad.append("stop").attr("offset","100%").attr("stop-color",arc.data.color).attr("stop-opacity",0.6);
        svg.append("path").datum(arc).attr("d",arcFn as any).attr("transform",`translate(${cx+pullX},${cy+pullY})`).attr("fill",`url(#${gradId})`).attr("stroke","#020c1b").attr("stroke-width",1.5).attr("filter",isHov?"url(#glow3d)":"none").attr("opacity",isHov?1:0.9).style("cursor","pointer").on("mouseover",()=>setHovered(i)).on("mouseout",()=>setHovered(null));
        const labelR = outerR+14;
        const lx = cx+Math.cos(midAngle-Math.PI/2)*labelR+pullX;
        const ly = cy+Math.sin(midAngle-Math.PI/2)*(ry/rx)*labelR+pullY;
        const pct = Math.round((arc.data.value/total)*100);
        svg.append("line").attr("x1",cx+Math.cos(midAngle-Math.PI/2)*(outerR-2)+pullX).attr("y1",cy+Math.sin(midAngle-Math.PI/2)*(ry/rx)*(outerR-2)+pullY).attr("x2",lx).attr("y2",ly).attr("stroke",arc.data.color).attr("stroke-width",1).attr("opacity",0.6);
        svg.append("text").attr("x",lx+(lx>cx?3:-3)).attr("y",ly).attr("text-anchor",lx>cx?"start":"end").attr("dominant-baseline","middle").attr("fill",arc.data.color).attr("font-size",9).attr("font-weight",700).attr("font-family","monospace").text(`${pct}%`);
      });
      svg.append("text").attr("x",cx).attr("y",cy-5).attr("text-anchor","middle").attr("fill","#c0d8f0").attr("font-size",11).attr("font-weight",800).attr("font-family","monospace").text("SCORE");
      svg.append("text").attr("x",cx).attr("y",cy+10).attr("text-anchor","middle").attr("fill","#00e5ff").attr("font-size",18).attr("font-weight",900).attr("font-family","monospace").text(Math.round(Number(state.composite_score)));
    }, [state, hovered]);
    return (
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <span style={{ fontSize:11, color:"#3a6a8a", letterSpacing:3 }}>FACTOR BREAKDOWN</span>
        </div>
        <svg ref={ref} width="100%" viewBox="0 0 260 190" style={{ overflow:"visible" }} />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5, marginTop:6 }}>
          {slices.map((s,i) => (
            <div key={s.label} style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 7px", borderRadius:5, background:hovered===i?`${s.color}18`:"#ffffff06", border:`1px solid ${hovered===i?s.color+"55":"#ffffff0a"}`, transition:"all 0.2s", cursor:"default" }} onMouseEnter={()=>setHovered(i)} onMouseLeave={()=>setHovered(null)}>
              <div style={{ width:8, height:8, borderRadius:2, background:s.color, flexShrink:0 }} />
              <span style={{ fontSize:10, color:hovered===i?s.color:"#7aaac8", fontWeight:700 }}>{s.label}</span>
              <span style={{ fontSize:11, color:s.color, fontWeight:900, fontFamily:"monospace", marginLeft:"auto" }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── WATERFALL CHART ──────────────────────────────────────────────────────────
  function WaterfallChart({ state }: { state: DBState }) {
    const ref = useRef<SVGSVGElement>(null);
    const W = 280, H = 120;
    useEffect(() => {
      if (!ref.current) return;
      const svg = d3.select(ref.current);
      svg.selectAll("*").remove();
      const m = { top: 14, right: 8, bottom: 28, left: 32 };
      const iW = W - m.left - m.right, iH = H - m.top - m.bottom;
      const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
      const factors = [
        { label: "CPI",     value: Math.round(Number(state.cpi_score)),     color: "#00e5ff", weight: 0.30 },
        { label: "ACCESS",  value: Math.round(Number(state.access_score)),  color: "#00ff9d", weight: 0.30 },
        { label: "TRANSIT", value: Math.round(Number(state.transit_score)), color: "#ff9500", weight: 0.20 },
        { label: "INCOME",  value: Math.round(Number(state.income_score)),  color: "#bf5fff", weight: 0.20 },
      ];
      const composite = Math.round(Number(state.composite_score));
      let running = 0;
      const bars = factors.map(f => {
        const contrib = Math.round(f.value * f.weight);
        const bar = { label: f.label, start: running, end: running + contrib, color: f.color, contrib };
        running += contrib;
        return bar;
      });
      bars.push({ label: "TOTAL", start: 0, end: composite, color: scoreColor(composite), contrib: composite });
      const yS = d3.scaleLinear().domain([0, 100]).range([iH, 0]);
      const xS = d3.scaleBand().domain(bars.map(b=>b.label)).range([0, iW]).padding(0.25);
      const defs = svg.append("defs");
      [25, 50, 75].forEach(t => {
        g.append("line").attr("x1",0).attr("x2",iW).attr("y1",yS(t)).attr("y2",yS(t)).attr("stroke","#ffffff07").attr("stroke-dasharray","2 6");
        g.append("text").attr("x",-6).attr("y",yS(t)+3).attr("text-anchor","end").attr("fill","#2a4a6a").attr("font-size",8).text(t);
      });
      bars.forEach((b, i) => {
        const isTotal = b.label === "TOTAL";
        const gid = `wf_${i}`;
        const grad = defs.append("linearGradient").attr("id",gid).attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",1);
        grad.append("stop").attr("offset","0%").attr("stop-color",b.color).attr("stop-opacity",isTotal?1:0.85);
        grad.append("stop").attr("offset","100%").attr("stop-color",b.color).attr("stop-opacity",0.3);
        const bx = xS(b.label) ?? 0;
        const bw = xS.bandwidth();
        const top = yS(b.end);
        const bot = isTotal ? yS(0) : yS(b.start);
        const bh = bot - top;
        if (!isTotal && i > 0) {
          g.append("line").attr("x1",bx-2).attr("x2",bx).attr("y1",yS(b.start)).attr("y2",yS(b.start)).attr("stroke","#ffffff18").attr("stroke-dasharray","2 3");
        }
        g.append("rect").attr("x",bx).attr("y",top).attr("width",bw).attr("height",Math.max(bh,2)).attr("fill",`url(#${gid})`).attr("rx",3);
        g.append("rect").attr("x",bx).attr("y",top).attr("width",bw).attr("height",3).attr("fill",b.color).attr("rx",2);
        g.append("text").attr("x",bx+bw/2).attr("y",top-5).attr("text-anchor","middle").attr("fill",b.color).attr("font-size",isTotal?11:10).attr("font-weight",900).attr("font-family","monospace").text(isTotal?b.end:b.contrib);
        g.append("text").attr("x",bx+bw/2).attr("y",iH+18).attr("text-anchor","middle").attr("fill","#4a7a9a").attr("font-size",9).text(b.label);
      });
    }, [state]);
    return (
      <div>
        <div style={{ fontSize:11, color:"#3a6a8a", letterSpacing:3, marginBottom:6 }}>SCORE WATERFALL</div>
        <svg ref={ref} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" />
      </div>
    );
  }

  // ─── HEATMAP GRID ─────────────────────────────────────────────────────────────
  function HeatmapGrid({ states }: { states: DBState[] }) {
    const regions = ["Northeast","Midwest","South","West"];
    const factors = ["cpi_score","access_score","transit_score","income_score"];
    const fLabels = ["CPI","ACCESS","TRANSIT","INCOME"];
    const fColors = ["#00e5ff","#00ff9d","#ff9500","#bf5fff"];
    return (
      <div>
        <div style={{ fontSize:11, color:"#3a6a8a", letterSpacing:3, marginBottom:8 }}>REGIONAL FACTOR HEATMAP</div>
        <div style={{ display:"grid", gridTemplateColumns:`80px repeat(${factors.length}, 1fr)`, gap:3 }}>
          <div />
          {fLabels.map((l,i) => (
            <div key={l} style={{ fontSize:9, color:fColors[i], textAlign:"center", letterSpacing:1, fontWeight:700, paddingBottom:4 }}>{l}</div>
          ))}
          {regions.map(region => {
            const group = states.filter(s => s.region === region);
            return [
              <div key={`${region}_label`} style={{ fontSize:10, color:"#7aaac8", display:"flex", alignItems:"center" }}>{region}</div>,
              ...factors.map((f,fi) => {
                const avg = group.length ? Math.round(group.reduce((a,s) => a + Number(s[f as keyof DBState] ?? 50), 0) / group.length) : 50;
                const tier = scoreTier(avg);
                return (
                  <div key={`${region}_${f}`} style={{ padding:"6px 4px", borderRadius:4, textAlign:"center", background:`${tier.color}22`, border:`1px solid ${tier.color}33`, fontSize:11, fontWeight:800, color:tier.color, fontFamily:"monospace" }}>{avg}</div>
                );
              })
            ];
          })}
        </div>
      </div>
    );
  }

  // ─── REGION REPORT ────────────────────────────────────────────────────────────
  function RegionReport({ state, states }: { state: DBState; states: DBState[] }) {
    const regionStates = states.filter(s => s.region === state.region);
    const regionAvg = regionStates.length ? Math.round(regionStates.reduce((a,s)=>a+Number(s.composite_score),0)/regionStates.length) : 50;
    const rank = [...states].sort((a,b)=>Number(b.composite_score)-Number(a.composite_score)).findIndex(s=>s.state_name===state.state_name)+1;
    const composite = Math.round(Number(state.composite_score));
    const vsAvg = composite - regionAvg;
    const tier = scoreTier(composite);
    const insights: { icon:string; text:string; color:string }[] = [];
    if (Number(state.cpi_score)<45) insights.push({icon:"⚠",text:"CPI pressure above critical threshold",color:"#ff3355"});
    if (Number(state.access_score)<45) insights.push({icon:"⚠",text:"Food access severely limited",color:"#ff3355"});
    if (Number(state.transit_score)>=65) insights.push({icon:"✓",text:"Strong transit infrastructure",color:"#00d97e"});
    if (Number(state.income_score)>=65) insights.push({icon:"✓",text:"Income stability above average",color:"#00d97e"});
    if (composite>regionAvg) insights.push({icon:"↑",text:`Outperforming ${state.region} avg by ${vsAvg} pts`,color:"#00e5ff"});
    else insights.push({icon:"↓",text:`Underperforming ${state.region} avg by ${Math.abs(vsAvg)} pts`,color:"#ff9500"});
    return (
      <div style={{ padding:14, borderBottom:"1px solid #0d2540" }}>
        <div style={{ fontSize:11, color:"#3a6a8a", letterSpacing:3, marginBottom:10 }}>REGIONAL REPORT</div>
        <div style={{ padding:"10px 12px", borderRadius:8, background:`${tier.color}0c`, border:`1px solid ${tier.color}33`, marginBottom:10 }}>
          <div style={{ fontSize:13, color:tier.color, fontWeight:800, marginBottom:4 }}>{state.state_name} · {state.region}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {[{label:"NATIONAL RANK",value:`#${rank}`,color:scoreColor(composite)},{label:"REGION AVG",value:regionAvg,color:scoreColor(regionAvg)},{label:"VS REGION",value:`${vsAvg>=0?"+":""}${vsAvg}`,color:vsAvg>=0?"#00d97e":"#ff3355"}].map(k=>(
              <div key={k.label} style={{ textAlign:"center" }}>
                <div style={{ fontSize:10, color:"#3a6a8a", letterSpacing:1, marginBottom:2 }}>{k.label}</div>
                <div style={{ fontSize:18, fontWeight:900, color:k.color, fontFamily:"monospace" }}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:"#3a6a8a", marginBottom:6 }}>REGION STATES ({regionStates.length})</div>
          {regionStates.sort((a,b)=>Number(b.composite_score)-Number(a.composite_score)).slice(0,5).map(s=>{
            const sc = Math.round(Number(s.composite_score));
            const isThis = s.state_name===state.state_name;
            return (
              <div key={s.state_id} style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 0", borderBottom:"1px solid #ffffff05" }}>
                <span style={{ fontSize:11, color:isThis?"#00e5ff":"#5a8aaa", fontWeight:isThis?900:400, width:32 }}>{s.state_code}</span>
                <div style={{ flex:1, height:5, background:"#ffffff08", borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${sc}%`, background:scoreColor(sc), borderRadius:3 }} />
                </div>
                <span style={{ fontSize:11, color:scoreColor(sc), fontWeight:800, fontFamily:"monospace", width:28, textAlign:"right" }}>{sc}</span>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize:11, color:"#3a6a8a", marginBottom:6 }}>KEY INSIGHTS</div>
        {insights.map((ins,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:7, marginBottom:5 }}>
            <span style={{ color:ins.color, fontSize:13, lineHeight:1.3 }}>{ins.icon}</span>
            <span style={{ fontSize:11, color:"#8ab4d0", lineHeight:1.5 }}>{ins.text}</span>
          </div>
        ))}
      </div>
    );
  }

  // ─── LEADERBOARD ──────────────────────────────────────────────────────────────
  function Leaderboard({ states, onSelect, selected }: { states:DBState[]; onSelect:(n:string)=>void; selected:string }) {
    const leaders = [...states].sort((a,b)=>Number(b.composite_score)-Number(a.composite_score)).slice(0,5);
    return (
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ fontSize:11, color:"#3a6a8a", letterSpacing:3 }}>TOP PERFORMERS</span>
          <span style={{ fontSize:10, color:"#00d97e", letterSpacing:1 }}>RANK · SCORE</span>
        </div>
        {leaders.map((s,i)=>{
          const score = Math.round(Number(s.composite_score));
          const pop = STATE_POPULATION[s.state_name]??s.population_2020;
          const isSelected = s.state_name===selected;
          return (
            <div key={s.state_id} onClick={()=>onSelect(s.state_name)} style={{ display:"grid", gridTemplateColumns:"26px 44px 1fr 44px", gap:8, alignItems:"center", padding:"8px 10px", marginBottom:5, borderRadius:8, cursor:"pointer", background:isSelected?"#00d97e10":"#ffffff04", border:isSelected?"1px solid #00d97e44":"1px solid #ffffff07", transition:"all 0.2s" }}>
              <span style={{ color:"#3a6a8a", fontSize:12 }}>#{i+1}</span>
              <span style={{ color:scoreColor(score), fontWeight:800, fontSize:14 }}>{s.state_code}</span>
              <div>
                <div style={{ fontSize:10, color:"#4a7a9a", marginBottom:3 }}>{(pop/1e6).toFixed(1)}M · {s.region}</div>
                <MiniBar value={score} color={scoreColor(score)} />
              </div>
              <span style={{ color:scoreColor(score), fontWeight:900, textAlign:"right", fontFamily:"monospace", fontSize:14 }}>{score}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── WATCHLIST ────────────────────────────────────────────────────────────────
  function Watchlist({ states, onSelect, selected }: { states:DBState[]; onSelect:(n:string)=>void; selected:string }) {
    const watch = [...states].sort((a,b)=>Number(a.composite_score)-Number(b.composite_score)).slice(0,5);
    return (
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ fontSize:11, color:"#3a6a8a", letterSpacing:3 }}>CRITICAL WATCH</span>
          <span style={{ fontSize:10, color:"#ff3355", letterSpacing:1 }}>LOWEST SCORES</span>
        </div>
        {watch.map(s=>{
          const score = Math.round(Number(s.composite_score));
          const pop = STATE_POPULATION[s.state_name]??s.population_2020;
          const isSelected = s.state_name===selected;
          return (
            <div key={s.state_id} onClick={()=>onSelect(s.state_name)} style={{ display:"grid", gridTemplateColumns:"44px 1fr 44px", gap:8, alignItems:"center", padding:"8px 10px", marginBottom:5, borderRadius:8, cursor:"pointer", background:isSelected?"#ff335510":"#ffffff04", border:isSelected?"1px solid #ff335533":"1px solid #ffffff07" }}>
              <span style={{ color:scoreColor(score), fontWeight:800, fontSize:14 }}>{s.state_code}</span>
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                  <span style={{ fontSize:10, color:"#4a7a9a" }}>{(pop/1e6).toFixed(1)}M pop.</span>
                  <ScoreBadge score={score} />
                </div>
                <MiniBar value={score} color="#ff3355" />
              </div>
              <span style={{ color:"#ff3355", fontWeight:900, textAlign:"right", fontFamily:"monospace", fontSize:14 }}>{score}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── REGIONAL BREAKDOWN ───────────────────────────────────────────────────────
  function RegionalBreakdown({ states }: { states:DBState[] }) {
    const regions = ["Northeast","Midwest","South","West"];
    const data = regions.map(r=>{
      const group = states.filter(s=>s.region===r);
      const avg = group.length?Math.round(group.reduce((a,s)=>a+Number(s.composite_score),0)/group.length):0;
      return { region:r, avg, count:group.length };
    }).filter(d=>d.count>0);
    return (
      <div>
        <div style={{ fontSize:11, color:"#3a6a8a", letterSpacing:3, marginBottom:10 }}>REGIONAL OVERVIEW</div>
        {data.map(d=>(
          <div key={d.region} style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:11, color:"#7aaac8" }}>{d.region}</span>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <span style={{ fontSize:10, color:"#3a6a8a" }}>{d.count} states</span>
                <span style={{ fontSize:13, color:scoreColor(d.avg), fontWeight:700, fontFamily:"monospace" }}>{d.avg}</span>
              </div>
            </div>
            <MiniBar value={d.avg} color={scoreColor(d.avg)} />
          </div>
        ))}
      </div>
    );
  }

  // ─── FIPS MAP ─────────────────────────────────────────────────────────────────
  const FIPS_TO_NAME: Record<string,string> = {
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

  // ─── 3D USA MAP ───────────────────────────────────────────────────────────────
  function USMap3D({ selected, onSelect, scoreMap }: {
    selected: string; onSelect: (name: string) => void; scoreMap: Record<string,number>;
  }) {
    const ref = useRef<SVGSVGElement>(null);
    const [geo, setGeo] = useState<any>(null);
    const [tooltip, setTooltip] = useState<{ x:number;y:number;name:string;score:number }|null>(null);
    useEffect(() => {
      fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
        .then(r=>r.json()).then(us=>setGeo(feature(us as any,(us as any).objects.states)));
    }, []);
    useEffect(() => {
      if (!ref.current || !geo) return;
      const W = ref.current.clientWidth || 600;
      const H = ref.current.clientHeight || 330;
      const svg = d3.select(ref.current);
      svg.selectAll("*").remove();
      const proj = d3.geoAlbersUsa().fitSize([W, H - 20], geo);
      const path = d3.geoPath().projection(proj);
      const getScore = (name:string) => scoreMap[name] ?? 50;
      const defs = svg.append("defs");
      const glow = defs.append("filter").attr("id","mapglow3d");
      glow.append("feGaussianBlur").attr("stdDeviation","5").attr("result","coloredBlur");
      const fm = glow.append("feMerge");
      fm.append("feMergeNode").attr("in","coloredBlur");
      fm.append("feMergeNode").attr("in","SourceGraphic");
      const depthG = svg.append("g").attr("transform","translate(3,6)");
      depthG.selectAll("path").data((geo as any).features).join("path")
        .attr("d", path as any).attr("fill","#010810").attr("opacity",0.5);
      const g = svg.append("g");
      g.selectAll("path").data((geo as any).features).join("path")
        .attr("d", path as any)
        .attr("fill", (d:any) => {
          const name = FIPS_TO_NAME[d.id?.toString().padStart(2,"0")];
          if (!name) return "#0a1520";
          if (name===selected) return "#00e5ff1a";
          const c = getScore(name);
          if (c>=65) return "#00331a";
          if (c>=45) return "#271500";
          return "#270008";
        })
        .attr("stroke", (d:any) => { const name = FIPS_TO_NAME[d.id?.toString().padStart(2,"0")]; return name===selected?"#00e5ff":"#0d2540"; })
        .attr("stroke-width", (d:any) => { const name = FIPS_TO_NAME[d.id?.toString().padStart(2,"0")]; return name===selected?2.5:0.6; })
        .attr("filter", (d:any) => { const name = FIPS_TO_NAME[d.id?.toString().padStart(2,"0")]; return name===selected?"url(#mapglow3d)":"none"; })
        .style("cursor","pointer").style("transition","fill 0.2s")
        .on("mouseover", function(event:any, d:any) {
          const name = FIPS_TO_NAME[(d as any).id?.toString().padStart(2,"0")];
          if (!name) return;
          const [mx,my] = d3.pointer(event, ref.current);
          setTooltip({ x:mx, y:my, name, score:getScore(name) });
          if (name!==selected) d3.select(this).attr("fill","#1a3a5c");
        })
        .on("mouseout", function(_:any,d:any) {
          setTooltip(null);
          const name = FIPS_TO_NAME[(d as any).id?.toString().padStart(2,"0")];
          if (!name||name===selected) return;
          const c = getScore(name);
          d3.select(this).attr("fill",c>=65?"#00331a":c>=45?"#271500":"#270008");
        })
        .on("click",(_:any,d:any)=>{ const name = FIPS_TO_NAME[(d as any).id?.toString().padStart(2,"0")]; if (name) onSelect(name); });
      (geo as any).features.forEach((feat: any) => {
        const name = FIPS_TO_NAME[feat.id?.toString().padStart(2,"0")];
        if (!name) return;
        const centroid = path.centroid(feat);
        if (!centroid || isNaN(centroid[0])) return;
        const score = getScore(name);
        g.append("circle").attr("cx", centroid[0]).attr("cy", centroid[1]).attr("r", name===selected?5:3.5).attr("fill", scoreColor(score)).attr("opacity", 0.85).attr("pointer-events","none");
      });
    }, [geo, selected, scoreMap]);
    return (
      <div style={{ position:"relative", width:"100%", height:"100%" }}>
        <svg ref={ref} style={{ width:"100%", height:"100%" }} />
        {tooltip && (
          <div style={{ position:"absolute", left:tooltip.x+14, top:tooltip.y-60, background:"#020c1bf8", border:`1px solid ${scoreColor(tooltip.score)}55`, borderRadius:8, padding:"8px 14px", pointerEvents:"none", fontFamily:"monospace", fontSize:12, color:"#c8e0f0" }}>
            <div style={{ color:scoreColor(tooltip.score), fontWeight:900, fontSize:14 }}>{tooltip.name}</div>
            <div style={{ color:"#6a9ab8", marginTop:3 }}>Score: <span style={{ color:scoreColor(tooltip.score), fontWeight:800 }}>{tooltip.score}</span> · Pop: {((STATE_POPULATION[tooltip.name]??0)/1e6).toFixed(1)}M</div>
            <ScoreBadge score={tooltip.score} />
          </div>
        )}
      </div>
    );
  }

  function Loading() {
    return (
      <div style={{ minHeight:"100vh", background:"#020c1b", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
        <div style={{ width:40, height:40, border:"2px solid #00e5ff44", borderTop:"2px solid #00e5ff", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ color:"#00e5ff", fontFamily:"monospace", fontSize:15, letterSpacing:3 }}>LOADING DATA...</div>
      </div>
    );
  }
  function ErrorView({ msg }: { msg:string }) {
    return (
      <div style={{ minHeight:"100vh", background:"#020c1b", padding:40, fontFamily:"monospace" }}>
        <div style={{ color:"#ff3355", fontSize:18, marginBottom:12 }}>❌ Error</div>
        <div style={{ color:"#ff6688", background:"#2d001022", border:"1px solid #ff335544", padding:14, borderRadius:8 }}>{msg}</div>
      </div>
    );
  }

  // ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
  export default function DeepDriveDashboard() {
    const [selected, setSelected] = useState<string>("California");
    const [now, setNow] = useState(new Date());
    const [pulse, setPulse] = useState(false);
    const [activeTab, setActiveTab] = useState("DEEP DIVE");

    const { states, loading: loadingStates, error: errorStates } = useAllStates();
    const { stats, loading: loadingStats } = useNationalStats();
    const selectedState = states.find(s=>s.state_name===selected)??null;
    const selectedCode = selectedState?.state_code??null;
    const { compositeArray } = useStateTrends(selectedCode);
    const handleSelect = useCallback((name:string)=>setSelected(name),[]);

    useEffect(()=>{
      const t = setInterval(()=>{ setNow(new Date()); setPulse(p=>!p); },1000);
      return ()=>clearInterval(t);
    },[]);

    if (loadingStates||loadingStats) return <Loading />;
    if (errorStates) return <ErrorView msg={errorStates} />;

    const composite    = selectedState?Math.round(Number(selectedState.composite_score)):50;
    const xpiScore     = selectedState?Math.round(Number(selectedState.cpi_score)):50;
    const accessScore  = selectedState?Math.round(Number(selectedState.access_score)):50;
    const transitScore = selectedState?Math.round(Number(selectedState.transit_score)):50;
    const incomeScore  = selectedState?Math.round(Number(selectedState.income_score)):50;

    const areaSqMiles = STATE_AREA[selected] ?? 0;
    const population  = STATE_POPULATION[selected] ?? selectedState?.population_2020 ?? 0;
    const popDensity  = areaSqMiles > 0 ? Math.round(population / areaSqMiles) : 0;

    const compTrend    = generateYearlyTrend(composite, 5);
    const xpiTrend     = generateYearlyTrend(xpiScore, 7);
    const accessTrend  = generateYearlyTrend(accessScore, 6);
    const transitTrend = generateYearlyTrend(transitScore, 5);
    const incomeTrend  = generateYearlyTrend(incomeScore, 4);

    const sparkComp = compositeArray.length >= 2 ? compositeArray : compTrend.slice(-12);

    const allScores = states.map(s=>Number(s.composite_score));
    const avgScore  = stats?Math.round(Number(stats.avg_score)):Math.round(allScores.reduce((a,b)=>a+b,0)/Math.max(allScores.length,1));
    const topState  = stats?.top_state_code??states.sort((a,b)=>Number(b.composite_score)-Number(a.composite_score))[0]?.state_code??"–";
    const criticalCount = stats?Number(stats.critical_count):states.filter(s=>Number(s.composite_score)<45).length;
    const highCount = states.filter(s=>Number(s.composite_score)>=65).length;
    const dispersion = stats?Math.round(Number(stats.dispersion)):Math.round(Math.max(...allScores,0)-Math.min(...allScores,100));
    const totalPop  = Object.values(STATE_POPULATION).reduce((a,b)=>a+b,0);

    const scoreMap: Record<string,number> = {};
    states.forEach(s=>{ scoreMap[s.state_name]=Math.round(Number(s.composite_score)); });
    const tier = scoreTier(composite);

    const kpis = [
      { label:"NATIONAL AVG",  value:avgScore,      sub:"Composite score",    color:scoreColor(avgScore), icon:"◈", extra:`${states.length} states` },
      { label:"TOP STATE",     value:topState,      sub:"Highest resilience", color:"#00e5ff",            icon:"★", extra:"#1 ranked", isText:true },
      { label:"HIGH ≥65",      value:highCount,     sub:"Resilient states",   color:"#00d97e",            icon:"▲", extra:`${Math.round(highCount/states.length*100)}%` },
      { label:"CRITICAL <45",  value:criticalCount, sub:"At-risk states",     color:"#ff3355",            icon:"⚠", extra:"Needs action" },
      { label:"SPREAD",        value:dispersion,    sub:"Max − Min range",    color:"#ff9500",            icon:"↔", extra:"Score gap" },
      { label:"US POPULATION", value:"335M",        sub:"Total coverage",     color:"#bf5fff",            icon:"◉", extra:"50 states", isText:true },
    ];

    return (
      <div style={{ minHeight:"100vh", background:"#020c1b", color:"#c0d8f0",
        fontFamily:"'JetBrains Mono','Fira Code',monospace",
        display:"flex", flexDirection:"column", overflow:"hidden", position:"relative", fontSize:13 }}>

        <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
          backgroundImage:"linear-gradient(#0d254008 1px,transparent 1px),linear-gradient(90deg,#0d254008 1px,transparent 1px)",
          backgroundSize:"32px 32px" }} />

        {/* HEADER */}
        {/* <header style={{ position:"relative", zIndex:10, display:"flex", alignItems:"center",
          justifyContent:"space-between", padding:"0 20px", height:52,
          borderBottom:"1px solid #0d2540", background:"#020c1bf8", backdropFilter:"blur(12px)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:8, background:"linear-gradient(135deg,#00e5ff22,#00d97e22)", border:"1px solid #00e5ff33", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🌾</div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:"#e0f4ff", letterSpacing:1.5 }}>FOOD RESILIENCE INTELLIGENCE</div>
              <div style={{ fontSize:10, color:"#3a6a8a", letterSpacing:2 }}>POSTGRESQL · LIVE · {states.length} STATES LOADED</div>
            </div>
          </div>
          <nav style={{ display:"flex", gap:2 }}>
            {["OVERVIEW","DEEP DIVE","TRENDS","ALERTS","EXPORT"].map(tab=>(
              <button key={tab} onClick={()=>setActiveTab(tab)} style={{ padding:"6px 16px", borderRadius:4, fontSize:10, letterSpacing:2, border:tab===activeTab?"1px solid #00e5ff66":"1px solid transparent", background:tab===activeTab?"#00e5ff12":"transparent", color:tab===activeTab?"#00e5ff":"#3a6a8a", cursor:"pointer", transition:"all 0.2s" }}>{tab}</button>
            ))}
          </nav>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#00d97e", boxShadow:pulse?"0 0 10px #00d97e":"none", transition:"box-shadow 0.5s" }} />
              <span style={{ fontSize:10, color:"#00d97e", letterSpacing:2 }}>LIVE</span>
            </div>
            <span style={{ fontSize:11, color:"#3a6a8a" }}>
              {now.toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"})}
            </span>
          </div>
        </header> */}

        {/* KPI ROW */}
        <div style={{ position:"relative", zIndex:10, display:"grid", gridTemplateColumns:"repeat(6,1fr)", borderBottom:"1px solid #0d2540" }}>
          {kpis.map((k,i)=>(
            <div key={i} style={{ padding:"12px 16px", borderRight:i<5?"1px solid #0d2540":"none", borderTop:`2px solid ${k.color}`, background:"#020c1b" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{ fontSize:10, color:"#3a6a8a", letterSpacing:2 }}>{k.label}</span>
                <span style={{ fontSize:14, color:k.color }}>{k.icon}</span>
              </div>
              <div style={{ fontSize:k.isText?24:34, fontWeight:900, color:k.color, fontFamily:"monospace", lineHeight:1, marginBottom:2 }}>{k.value}</div>
              <div style={{ fontSize:10, color:"#2a4a6a", marginBottom:4 }}>{k.sub}</div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <Sparkline data={sparkComp} color={k.color} height={26} width={80} />
                <span style={{ fontSize:9, color:k.color, opacity:0.7 }}>{k.extra}</span>
              </div>
            </div>
          ))}
        </div>

        {/* MAIN LAYOUT */}
        <div style={{ position:"relative", zIndex:10, flex:1, display:"grid",
          gridTemplateColumns:"295px 1fr 335px", minHeight:0, overflow:"hidden" }}>

          {/* ── LEFT PANEL — FACTOR GAUGES (replaces score cards) ── */}
          <div style={{ borderRight:"1px solid #0d2540", display:"flex", flexDirection:"column", background:"#020c1b", overflowY:"auto" }}>

            {/* State Info */}
            <div style={{ padding:14, borderBottom:"1px solid #0d2540" }}>
              <div style={{ fontSize:10, color:"#3a6a8a", letterSpacing:3, marginBottom:8 }}>SELECTED STATE</div>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:20, fontWeight:800, color:"#e0f4ff", marginBottom:2 }}>{selected}</div>
                  <div style={{ fontSize:11, color:"#3a6a8a" }}>{selectedState?.state_code} · {selectedState?.region}</div>
                </div>
                <ScoreBadge score={composite} />
              </div>
              <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:14 }}>
                <RadialGauge value={composite} color={tier.color} size={76} />
                <div>
                  <div style={{ fontSize:11, color:"#3a6a8a", marginBottom:4 }}>COMPOSITE SCORE</div>
                  <div style={{ fontSize:11, color:"#3a6a8a" }}>Pop: <span style={{ color:"#7aaac8" }}>{(population/1e6).toFixed(2)}M</span></div>
                  <div style={{ fontSize:11, color:"#3a6a8a" }}>Density: <span style={{ color:"#7aaac8" }}>{popDensity}/mi²</span></div>
                  <div style={{ fontSize:11, color:"#3a6a8a" }}>Area: <span style={{ color:"#7aaac8" }}>{areaSqMiles.toLocaleString()} mi²</span></div>
                </div>
              </div>
            </div>

            {/* ── FACTOR GAUGES (NEW — replaces score cards) ── */}
            {selectedState && (
              <div style={{ padding:12, borderBottom:"1px solid #0d2540" }}>
                <GaugeCluster state={selectedState} />
              </div>
            )}

            {/* ── RADAR PROFILE (NEW) ── */}
            {selectedState && states.length > 0 && (
              <div style={{ padding:12, borderBottom:"1px solid #0d2540" }}>
                <RadarChart state={selectedState} states={states} />
              </div>
            )}

            {/* ── DIVERGING BAR VS NAT AVG (NEW) ── */}
            {selectedState && states.length > 0 && (
              <div style={{ padding:12, borderBottom:"1px solid #0d2540" }}>
                <DivergingBar state={selectedState} states={states} />
              </div>
            )}

            {/* ── TREND VELOCITY (NEW) ── */}
            <div style={{ padding:12, borderBottom:"1px solid #0d2540" }}>
              <TrendVelocity trends={[
                { label:"COMPOSITE", color: scoreColor(composite), data: compTrend },
                { label:"CPI",       color:"#00e5ff",              data: xpiTrend },
                { label:"ACCESS",    color:"#00ff9d",              data: accessTrend },
                { label:"TRANSIT",   color:"#ff9500",              data: transitTrend },
                { label:"INCOME",    color:"#bf5fff",              data: incomeTrend },
              ]} />
            </div>

            {/* Regional */}
            <div style={{ padding:10 }}>
              <RegionalBreakdown states={states} />
            </div>
          </div>

          {/* ── CENTER PANEL ── */}
          <div style={{ display:"flex", flexDirection:"column", background:"#020c1b", overflow:"hidden" }}>

            <div style={{ padding:"8px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid #0d2540" }}>
              <div>
                <div style={{ fontSize:10, color:"#3a6a8a", letterSpacing:3 }}>LIVE POSTGRESQL DATA</div>
                <div style={{ fontSize:15, fontWeight:700, color:"#e0f4ff" }}>USA FOOD RESILIENCE MAP · 3D</div>
              </div>
              <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                {[{label:"HIGH ≥65",color:"#00d97e"},{label:"MODERATE",color:"#ff9500"},{label:"CRITICAL <45",color:"#ff3355"}].map(l=>(
                  <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:l.color }} />
                    <span style={{ fontSize:10, color:"#7aaac8", letterSpacing:1 }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex:"0 0 280px", position:"relative" }}>
              <USMap3D selected={selected} onSelect={handleSelect} scoreMap={scoreMap} />
            </div>

            {/* ── VERTICAL BAR CHART (replaces MountainLineChart) ── */}
            <div style={{ padding:"10px 16px 10px", borderTop:"1px solid #0d2540", flex:1, overflow:"hidden" }}>
              <VerticalBarChart
                title="FACTOR VARIATIONS 2015 → 2025"
                datasets={[
                  { data: compTrend,    color: scoreColor(composite), label: "COMPOSITE" },
                  { data: xpiTrend,     color: "#00e5ff",             label: "CPI" },
                  { data: accessTrend,  color: "#00ff9d",             label: "ACCESS" },
                  { data: transitTrend, color: "#ff9500",             label: "TRANSIT" },
                  { data: incomeTrend,  color: "#bf5fff",             label: "INCOME" },
                ]}
                height={175}
                width={580}
              />
            </div>

            <div style={{ padding:"8px 16px 12px", borderTop:"1px solid #0d2540" }}>
              <HeatmapGrid states={states} />
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div style={{ borderLeft:"1px solid #0d2540", display:"flex", flexDirection:"column", background:"#020c1b", overflowY:"auto" }}>

            {selectedState && (
              <div style={{ padding:14, borderBottom:"1px solid #0d2540" }}>
                <Pie3DChart state={selectedState} />
              </div>
            )}

            {selectedState && (
              <div style={{ padding:14, borderBottom:"1px solid #0d2540" }}>
                <WaterfallChart state={selectedState} />
              </div>
            )}

            {selectedState && <RegionReport state={selectedState} states={states} />}

            <div style={{ padding:14, borderBottom:"1px solid #0d2540" }}>
              <Leaderboard states={states} onSelect={setSelected} selected={selected} />
            </div>

            <div style={{ padding:14, borderBottom:"1px solid #0d2540" }}>
              <Watchlist states={states} onSelect={setSelected} selected={selected} />
            </div>

            <div style={{ padding:14 }}>
              <div style={{ fontSize:11, color:"#3a6a8a", letterSpacing:3, marginBottom:10 }}>STATE STATISTICS</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                {[{label:"CPI",value:xpiScore,color:"#00e5ff"},{label:"ACCESS",value:accessScore,color:"#00ff9d"},{label:"TRANSIT",value:transitScore,color:"#ff9500"},{label:"INCOME",value:incomeScore,color:"#bf5fff"}].map(k=>(
                  <div key={k.label} style={{ padding:"8px 10px", borderRadius:6, background:`${k.color}08`, border:`1px solid ${k.color}22` }}>
                    <div style={{ fontSize:10, color:"#3a6a8a", letterSpacing:2, marginBottom:2 }}>{k.label}</div>
                    <div style={{ fontSize:22, fontWeight:800, color:k.color, fontFamily:"monospace" }}>{k.value}</div>
                    <MiniBar value={k.value} color={k.color} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop:8, padding:"8px 10px", borderRadius:6, background:"#bf5fff08", border:"1px solid #bf5fff22" }}>
                <div style={{ fontSize:10, color:"#3a6a8a", letterSpacing:2, marginBottom:2 }}>POPULATION</div>
                <div style={{ fontSize:18, fontWeight:800, color:"#bf5fff", fontFamily:"monospace" }}>{(population/1e6).toFixed(2)}M</div>
                <div style={{ fontSize:10, color:"#3a6a8a", marginTop:2 }}>{((population/totalPop)*100).toFixed(1)}% of US total</div>
              </div>
              <div style={{ marginTop:8, display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                <div style={{ padding:"8px 10px", borderRadius:6, background:"#00e5ff08", border:"1px solid #00e5ff22" }}>
                  <div style={{ fontSize:10, color:"#3a6a8a", letterSpacing:2, marginBottom:2 }}>AREA</div>
                  <div style={{ fontSize:14, fontWeight:800, color:"#00e5ff", fontFamily:"monospace" }}>{areaSqMiles.toLocaleString()}</div>
                  <div style={{ fontSize:9, color:"#3a6a8a" }}>sq miles</div>
                </div>
                <div style={{ padding:"8px 10px", borderRadius:6, background:"#00ff9d08", border:"1px solid #00ff9d22" }}>
                  <div style={{ fontSize:10, color:"#3a6a8a", letterSpacing:2, marginBottom:2 }}>DENSITY</div>
                  <div style={{ fontSize:14, fontWeight:800, color:"#00ff9d", fontFamily:"monospace" }}>{popDensity}</div>
                  <div style={{ fontSize:9, color:"#3a6a8a" }}>per mi²</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ position:"relative", zIndex:10, borderTop:"1px solid #0d2540",
          padding:"5px 20px", display:"flex", alignItems:"center", justifyContent:"space-between",
          background:"#020c1b", fontSize:9, color:"#1a3a5a", letterSpacing:2 }}>
          <span>FOOD RESILIENCE INTELLIGENCE · CPI · ACCESS · TRANSIT · INCOME</span>
          <span style={{ color:"#00d97e44" }}>● LIVE POSTGRESQL · {states.length} STATES</span>
          <span>© 2026 INTELLIGENCE PLATFORM</span>
        </div>
      </div>
    );
  }