"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as d3 from "d3";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const REGIONS = ["Northeast", "Midwest", "South", "West"] as const;
type Region = typeof REGIONS[number];

const REGION_COLORS: Record<Region, string> = {
  Northeast: "#00e5ff",
  Midwest: "#00ff9d",
  South: "#ff9500",
  West: "#bf5fff",
};

const FACTOR_META = [
  { key: "xpi_score",     label: "CPI",       full: "Price / CPI Pressure",  color: "#00e5ff", weight: 0.35 },
  { key: "access_score",  label: "ACCESS",    full: "Food Accessibility",    color: "#00ff9d", weight: 0.28 },
  { key: "transit_score", label: "TRANSIT",   full: "Transit Density",       color: "#ff9500", weight: 0.20 },
  { key: "income_score",  label: "INCOME",    full: "Income Stability",      color: "#bf5fff", weight: 0.17 },
] as const;

const YEARS = ["2015","2016","2017","2018","2019","2020","2021","2022","2023","2024","2025"];

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface StateData {
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

interface NationalStats {
  avg_score: number;
  max_score: number;
  min_score: number;
  dispersion: number;
  critical_count: number;
  top_state_code: string;
  top_state_name: string;
}

interface TrendPoint {
  year: number;
  composite: number;
  cpi: number;
  access: number;
  transit: number;
  income: number;
  label: string;
}

interface RegionTrend {
  region: Region;
  color: string;
  data: TrendPoint[];
  currentAvg: number;
  velocity: number;
  states: StateData[];
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function scoreColor(v: number): string {
  if (v >= 65) return "#00ff9d";
  if (v >= 50) return "#00d4ff";
  if (v >= 40) return "#ff9500";
  return "#ff2d55";
}

function scoreTierLabel(v: number): string {
  if (v >= 65) return "RESILIENT";
  if (v >= 50) return "MODERATE";
  if (v >= 40) return "HIGH RISK";
  return "CRITICAL";
}

function generateYearlyTrend(base: number, volatility = 5): number[] {
  let val = Math.max(20, Math.min(90, base - 12 + Math.random() * 8));
  return YEARS.map(() => {
    const drift = (base - val) * 0.14;
    val = Math.max(15, Math.min(100, val + drift + (Math.random() - 0.42) * volatility));
    return parseFloat(val.toFixed(1));
  });
}

function buildTrendPoints(base: number, vola = 5): TrendPoint[] {
  const comp    = generateYearlyTrend(base, vola);
  const cpi     = generateYearlyTrend(base * 0.97, vola + 2);
  const access  = generateYearlyTrend(base * 1.05, vola);
  const transit = generateYearlyTrend(base * 0.92, vola + 1);
  const income  = generateYearlyTrend(base * 1.02, vola - 1);
  return YEARS.map((yr, i) => ({
    year: parseInt(yr), label: yr,
    composite: comp[i], cpi: cpi[i],
    access: access[i], transit: transit[i], income: income[i],
  }));
}

function buildRegionTrends(states: StateData[]): RegionTrend[] {
  return REGIONS.map(region => {
    const group = states.filter(s => s.region === region);
    const avg = group.length
      ? group.reduce((a, s) => a + Number(s.composite_score), 0) / group.length
      : 55;
    const data = buildTrendPoints(avg, 4 + group.length * 0.1);
    const n = data.length;
    const velocity = n >= 3 ? parseFloat(((data[n-1].composite - data[n-3].composite) / 2).toFixed(1)) : 0;
    return { region, color: REGION_COLORS[region], data, currentAvg: Math.round(avg), velocity, states: group };
  });
}

// ─── ANIMATED NUMBER ─────────────────────────────────────────────────────────
function AnimNumber({ value, decimals = 0, duration = 1200 }: { value: number; decimals?: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef  = useRef(0);
  const rafRef   = useRef<number>(0);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = null;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(parseFloat((fromRef.current + (value - fromRef.current) * eased).toFixed(decimals)));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{display.toFixed(decimals)}</>;
}

// ─── PULSE DOT ────────────────────────────────────────────────────────────────
function PulseDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: size + 8, height: size + 8, alignItems: "center", justifyContent: "center" }}>
      <span style={{
        position: "absolute", width: size + 8, height: size + 8, borderRadius: "50%",
        background: color, opacity: 0.2, animation: "pulseRing 1.5s ease-out infinite",
      }} />
      <span style={{ width: size, height: size, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
    </span>
  );
}

// ─── MINI SPARKLINE ───────────────────────────────────────────────────────────
function MicroSpark({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || data.length < 2) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const xS = d3.scaleLinear().domain([0, data.length - 1]).range([0, width]);
    const yS = d3.scaleLinear().domain([d3.min(data)! - 2, d3.max(data)! + 2]).range([height - 2, 2]);
    const line = d3.line<number>().x((_, i) => xS(i)).y(d => yS(d)).curve(d3.curveCatmullRom);
    const area = d3.area<number>().x((_, i) => xS(i)).y0(height).y1(d => yS(d)).curve(d3.curveCatmullRom);
    const gid = `ms${Math.random().toString(36).slice(2,6)}`;
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", gid).attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",1);
    grad.append("stop").attr("offset","0%").attr("stop-color",color).attr("stop-opacity",0.4);
    grad.append("stop").attr("offset","100%").attr("stop-color",color).attr("stop-opacity",0);
    svg.append("path").datum(data).attr("d",area).attr("fill",`url(#${gid})`);
    svg.append("path").datum(data).attr("d",line).attr("fill","none").attr("stroke",color).attr("stroke-width",1.8);
    const last = data[data.length-1];
    svg.append("circle").attr("cx",xS(data.length-1)).attr("cy",yS(last)).attr("r",2.5).attr("fill",color).attr("filter",`drop-shadow(0 0 4px ${color})`);
  }, [data, color, width, height]);
  return <svg ref={ref} width={width} height={height} style={{ overflow: "visible" }} />;
}

// ─── 3D RIBBON CHART ─────────────────────────────────────────────────────────
function RibbonTrendChart({ regions, selectedRegion, onHover }: {
  regions: RegionTrend[];
  selectedRegion: Region | null;
  onHover: (r: RegionTrend | null, year?: string, val?: number) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 320 });

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setDims({ w: e.contentRect.width, h: e.contentRect.height });
    });
    if (ref.current?.parentElement) obs.observe(ref.current.parentElement);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!ref.current || !regions.length) return;
    const { w, h } = dims;
    const m = { top: 30, right: 24, bottom: 44, left: 48 };
    const iW = w - m.left - m.right;
    const iH = h - m.top - m.bottom;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${w} ${h}`);

    const allVals = regions.flatMap(r => r.data.map(d => d.composite));
    const xS = d3.scalePoint().domain(YEARS).range([0, iW]);
    const yS = d3.scaleLinear().domain([Math.max(0, d3.min(allVals)! - 5), Math.min(100, d3.max(allVals)! + 5)]).range([iH, 0]);

    const defs = svg.append("defs");
    const glow = defs.append("filter").attr("id","ribbon_glow").attr("x","-20%").attr("y","-20%").attr("width","140%").attr("height","140%");
    glow.append("feGaussianBlur").attr("stdDeviation","4").attr("result","blur");
    const fm = glow.append("feMerge");
    fm.append("feMergeNode").attr("in","blur");
    fm.append("feMergeNode").attr("in","SourceGraphic");

    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const gridTicks = yS.ticks(5);
    gridTicks.forEach(t => {
      g.append("line").attr("x1",0).attr("x2",iW).attr("y1",yS(t)).attr("y2",yS(t))
        .attr("stroke","#ffffff07").attr("stroke-dasharray","3 8");
      g.append("text").attr("x",-10).attr("y",yS(t)+4).attr("text-anchor","end")
        .attr("fill","#2a4a6a").attr("font-size",9).attr("font-family","monospace").text(t);
    });

    const bandData = [
      { y1: 65, y2: 100, color: "#00ff9d" },
      { y1: 50, y2: 65,  color: "#00d4ff" },
      { y1: 40, y2: 50,  color: "#ff9500" },
      { y1: 0,  y2: 40,  color: "#ff2d55" },
    ];
    bandData.forEach(b => {
      const y1c = Math.max(0, yS(b.y2));
      const y2c = Math.min(iH, yS(b.y1));
      if (y2c > y1c) {
        g.append("rect").attr("x",0).attr("y",y1c).attr("width",iW).attr("height",y2c - y1c)
          .attr("fill",b.color).attr("opacity",0.025);
      }
    });

    regions.forEach(r => {
      const line = d3.line<TrendPoint>().x(d => xS(String(d.year))!).y(d => yS(d.composite) + 6).curve(d3.curveCatmullRom);
      const area = d3.area<TrendPoint>().x(d => xS(String(d.year))!).y0(iH + 6).y1(d => yS(d.composite) + 6).curve(d3.curveCatmullRom);
      g.append("path").datum(r.data).attr("d",area).attr("fill","rgba(0,0,0,0.35)").attr("opacity",0.5);
      g.append("path").datum(r.data).attr("d",line).attr("fill","none").attr("stroke","rgba(0,0,0,0.4)").attr("stroke-width",4);
    });

    regions.forEach(r => {
      const isActive = selectedRegion === null || selectedRegion === r.region;
      const opacity = isActive ? 1 : 0.18;
      const gid = `ribbon_${r.region.replace(/ /g,"_")}`;

      const grad = defs.append("linearGradient").attr("id",gid).attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",1);
      grad.append("stop").attr("offset","0%").attr("stop-color",r.color).attr("stop-opacity",0.55);
      grad.append("stop").attr("offset","100%").attr("stop-color",r.color).attr("stop-opacity",0.04);

      const area = d3.area<TrendPoint>().x(d => xS(String(d.year))!).y0(iH).y1(d => yS(d.composite)).curve(d3.curveCatmullRom);
      const line = d3.line<TrendPoint>().x(d => xS(String(d.year))!).y(d => yS(d.composite)).curve(d3.curveCatmullRom);

      g.append("path").datum(r.data).attr("d",line).attr("fill","none").attr("stroke",r.color).attr("stroke-width",6)
        .attr("opacity",isActive ? 0.15 : 0).attr("filter","url(#ribbon_glow)").style("pointer-events","none");
      g.append("path").datum(r.data).attr("d",area).attr("fill",`url(#${gid})`).attr("opacity",opacity);

      const path = g.append("path").datum(r.data).attr("d",line).attr("fill","none")
        .attr("stroke",r.color).attr("stroke-width", isActive ? 2.5 : 1.5).attr("opacity",opacity)
        .style("cursor","pointer");

      r.data.forEach((d, i) => {
        if (!isActive) return;
        const cx = xS(String(d.year))!;
        const cy = yS(d.composite);
        g.append("circle").attr("cx",cx).attr("cy",cy).attr("r",3).attr("fill",r.color)
          .attr("opacity",0.8).attr("pointer-events","none");
        if (i === r.data.length - 1) {
          g.append("circle").attr("cx",cx).attr("cy",cy).attr("r",5.5).attr("fill","none")
            .attr("stroke",r.color).attr("stroke-width",1.5).attr("opacity",0.6).attr("pointer-events","none");
          g.append("text").attr("x",cx+8).attr("y",cy+4).attr("fill",r.color).attr("font-size",10)
            .attr("font-weight",800).attr("font-family","monospace").attr("pointer-events","none")
            .text(d.composite.toFixed(0));
        }
      });

      path.on("mouseover", () => onHover(r)).on("mouseout", () => onHover(null));
    });

    YEARS.forEach(yr => {
      const cx = xS(yr)!;
      const zone = g.append("rect").attr("x", cx - 20).attr("y", 0).attr("width", 40).attr("height", iH)
        .attr("fill","transparent").style("cursor","crosshair");
      zone.on("mousemove", () => {
        g.selectAll(".yr-hover-line").remove();
        g.append("line").attr("class","yr-hover-line")
          .attr("x1",cx).attr("x2",cx).attr("y1",0).attr("y2",iH)
          .attr("stroke","rgba(255,255,255,0.15)").attr("stroke-width",1).attr("pointer-events","none");
        const activeR = selectedRegion ? regions.find(r => r.region === selectedRegion) : regions[0];
        if (activeR) {
          const pt = activeR.data.find(d => String(d.year) === yr);
          if (pt) onHover(activeR, yr, pt.composite);
        }
      }).on("mouseout", () => {
        g.selectAll(".yr-hover-line").remove();
        onHover(null);
      });
    });

    YEARS.forEach((yr, i) => {
      if (i % 2 === 0 || i === YEARS.length - 1) {
        g.append("text").attr("x", xS(yr)!).attr("y", iH + 20).attr("text-anchor","middle")
          .attr("fill","#3a6a8a").attr("font-size",10).attr("font-family","monospace").text(yr);
      }
    });

    g.selectAll(".yr-tick").data(YEARS.filter((_,i) => i%2===0)).join("line")
      .attr("class","yr-tick").attr("x1", d => xS(d)!).attr("x2", d => xS(d)!).attr("y1", iH).attr("y2", iH + 5)
      .attr("stroke","#1a3a5a").attr("stroke-width",1);

  }, [regions, selectedRegion, dims]);

  return <svg ref={ref} style={{ width:"100%", height:"100%", display:"block" }} />;
}

// ─── FACTOR RADIAL BURST ─────────────────────────────────────────────────────
function RadialBurst({ state }: { state: StateData }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const W = 220, H = 220, cx = 110, cy = 110, R = 80;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const factors = FACTOR_META.map(f => ({
      ...f, value: Math.round(Number(state[f.key as keyof StateData] ?? 50))
    }));
    const n = factors.length;
    const angleSlice = (Math.PI * 2) / n;

    const defs = svg.append("defs");
    const glow = defs.append("filter").attr("id","burst_glow");
    glow.append("feGaussianBlur").attr("stdDeviation","5").attr("result","blur");
    const fm = glow.append("feMerge");
    fm.append("feMergeNode").attr("in","blur");
    fm.append("feMergeNode").attr("in","SourceGraphic");

    [25,50,75,100].forEach(t => {
      const pts = factors.map((_, i) => {
        const a = angleSlice * i - Math.PI / 2;
        return `${cx + R * (t/100) * Math.cos(a)},${cy + R * (t/100) * Math.sin(a)}`;
      }).join(" ");
      svg.append("polygon").attr("points",pts).attr("fill","none")
        .attr("stroke",t===50?"rgba(255,149,0,0.2)":"rgba(255,255,255,0.05)").attr("stroke-width",t===50?1:0.5);
    });

    factors.forEach((_, i) => {
      const a = angleSlice * i - Math.PI / 2;
      svg.append("line").attr("x1",cx).attr("y1",cy)
        .attr("x2",cx + R * Math.cos(a)).attr("y2",cy + R * Math.sin(a))
        .attr("stroke","rgba(255,255,255,0.07)").attr("stroke-width",1);
    });

    const pts = factors.map((f, i) => {
      const a = angleSlice * i - Math.PI / 2;
      const r = R * (f.value / 100);
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number,number];
    });

    const gradId = "burst_fill";
    const grad = defs.append("radialGradient").attr("id",gradId);
    grad.append("stop").attr("offset","0%").attr("stop-color","#00e5ff").attr("stop-opacity",0.45);
    grad.append("stop").attr("offset","100%").attr("stop-color","#00e5ff").attr("stop-opacity",0.04);

    svg.append("polygon").attr("points", pts.map(p=>p.join(",")).join(" "))
      .attr("fill",`url(#${gradId})`).attr("stroke","#00e5ff").attr("stroke-width",2)
      .attr("filter","url(#burst_glow)").attr("stroke-linejoin","round");

    factors.forEach((f, i) => {
      const [x, y] = pts[i];
      const isHov = hovered === i;
      svg.append("circle").attr("cx",x).attr("cy",y).attr("r", isHov ? 6 : 4)
        .attr("fill", f.color).attr("stroke","#020c1b").attr("stroke-width",1.5)
        .attr("filter",isHov?"url(#burst_glow)":"none")
        .style("cursor","pointer")
        .on("mouseover", () => setHovered(i))
        .on("mouseout",  () => setHovered(null));

      const la = angleSlice * i - Math.PI / 2;
      const lx = cx + (R + 18) * Math.cos(la);
      const ly = cy + (R + 18) * Math.sin(la);
      svg.append("text").attr("x",lx).attr("y",ly).attr("text-anchor","middle")
        .attr("dominant-baseline","central").attr("fill", isHov ? f.color : "#7aaac8")
        .attr("font-size", isHov ? 10 : 9).attr("font-weight",700).attr("font-family","monospace")
        .text(f.label);
    });

    const comp = Math.round(Number(state.composite_score));
    svg.append("text").attr("x",cx).attr("y",cy-8).attr("text-anchor","middle")
      .attr("fill","#c0d8f0").attr("font-size",9).attr("font-family","monospace").attr("opacity",0.6).text("COMPOSITE");
    svg.append("text").attr("x",cx).attr("y",cy+10).attr("text-anchor","middle")
      .attr("fill",scoreColor(comp)).attr("font-size",22).attr("font-weight",900).attr("font-family","monospace").text(comp);

    if (hovered !== null) {
      const f = factors[hovered];
      svg.append("text").attr("x",cx).attr("y",cy+28).attr("text-anchor","middle")
        .attr("fill",f.color).attr("font-size",11).attr("font-weight",800).attr("font-family","monospace")
        .text(`${f.label}: ${f.value}`);
    }
  }, [state, hovered]);

  return (
    <svg ref={ref} width="100%" viewBox="0 0 220 220"
      style={{ overflow:"visible", display:"block", margin: "0 auto" }} />
  );
}

// ─── VELOCITY METER ──────────────────────────────────────────────────────────
function VelocityMeter({ velocity, color }: { velocity: number; color: string }) {
  const clamped = Math.max(-10, Math.min(10, velocity));
  const pct = ((clamped + 10) / 20) * 100;
  const dir = velocity > 0.3 ? "▲" : velocity < -0.3 ? "▼" : "→";
  const vc = velocity > 0.3 ? "#00ff9d" : velocity < -0.3 ? "#ff2d55" : "#ff9500";
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5, alignItems:"center" }}>
        <span style={{ fontSize:9, color:"#3a6a8a", letterSpacing:2.5, fontWeight:700 }}>VELOCITY</span>
        <span style={{ fontSize:13, fontWeight:900, color:vc, fontFamily:"monospace" }}>
          {dir} {velocity > 0 ? "+" : ""}{velocity.toFixed(1)} pts/yr
        </span>
      </div>
      <div style={{ height:6, background:"#ffffff08", borderRadius:3, overflow:"hidden", position:"relative" }}>
        <div style={{ position:"absolute", left:0, top:0, width:`${pct}%`, height:"100%",
          background:`linear-gradient(90deg,#ff2d55,#ff9500,#00ff9d)`, borderRadius:3 }} />
        <div style={{ position:"absolute", left:"50%", top:0, width:1, height:"100%", background:"rgba(255,255,255,0.2)" }} />
      </div>
    </div>
  );
}

// ─── HEATMAP MATRIX ──────────────────────────────────────────────────────────
function HeatMatrix({ regions, selectedRegion, onSelect }: {
  regions: RegionTrend[];
  selectedRegion: Region | null;
  onSelect: (r: Region | null) => void;
}) {
  const [hovCell, setHovCell] = useState<{r:number;y:number}|null>(null);

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display:"grid", gridTemplateColumns:`100px repeat(${YEARS.length},1fr)`,
        gap:2, minWidth:600 }}>
        <div />
        {YEARS.map(yr => (
          <div key={yr} style={{ fontSize:9, color:"#3a6a8a", textAlign:"center",
            letterSpacing:1, fontWeight:700, paddingBottom:4 }}>{yr.slice(2)}</div>
        ))}
        {regions.map((r, ri) => {
          const isSel = selectedRegion === r.region;
          return [
            <div key={`${r.region}_label`}
              onClick={() => onSelect(isSel ? null : r.region)}
              style={{ fontSize:10, color: isSel ? r.color : "#6a9ab8", display:"flex",
                alignItems:"center", cursor:"pointer", fontWeight: isSel ? 800 : 400,
                padding:"2px 6px", borderRadius:4,
                background: isSel ? `${r.color}18` : "transparent", transition:"all 0.2s" }}>
              {r.region.toUpperCase().slice(0,2)}
            </div>,
            ...r.data.map((d, yi) => {
              const isHov = hovCell?.r === ri && hovCell?.y === yi;
              const c = scoreColor(d.composite);
              return (
                <div key={`${r.region}_${d.year}`}
                  onClick={() => onSelect(isSel ? null : r.region)}
                  onMouseEnter={() => setHovCell({r:ri, y:yi})}
                  onMouseLeave={() => setHovCell(null)}
                  style={{ padding:"5px 2px", borderRadius:3, textAlign:"center",
                    background: isHov ? `${c}40` : `${c}18`,
                    border:`1px solid ${isHov||isSel?c+"55":"transparent"}`,
                    fontSize:10, fontWeight:800, color:c, fontFamily:"monospace",
                    cursor:"pointer", transition:"all 0.15s",
                    opacity: selectedRegion && !isSel ? 0.4 : 1 }}>
                  {d.composite.toFixed(0)}
                </div>
              );
            })
          ];
        })}
      </div>
    </div>
  );
}

// ─── WATERFALL SCORE DECOMP ───────────────────────────────────────────────────
function WaterfallDecomp({ region }: { region: RegionTrend }) {
  const ref = useRef<SVGSVGElement>(null);
  const W = 280, H = 130;
  const lastPt = region.data[region.data.length - 1];
  const firstPt = region.data[0];

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const m = { top:14, right:8, bottom:28, left:32 };
    const iW = W-m.left-m.right, iH = H-m.top-m.bottom;
    const g = svg.append("g").attr("transform",`translate(${m.left},${m.top})`);

    const items = [
      { label:"COMP", val:firstPt.composite, color:"#5a7aaa" },
      { label:"CPI",  val:lastPt.cpi - firstPt.cpi,       color: FACTOR_META[0].color, isDelta:true },
      { label:"ACC",  val:lastPt.access - firstPt.access,  color: FACTOR_META[1].color, isDelta:true },
      { label:"TRN",  val:lastPt.transit - firstPt.transit,color: FACTOR_META[2].color, isDelta:true },
      { label:"INC",  val:lastPt.income - firstPt.income,  color: FACTOR_META[3].color, isDelta:true },
      { label:"NOW",  val:lastPt.composite, color:scoreColor(lastPt.composite) },
    ];

    const xS = d3.scaleBand().domain(items.map(d=>d.label)).range([0,iW]).padding(0.25);
    const yS = d3.scaleLinear().domain([0, 100]).range([iH,0]);

    [25,50,75].forEach(t => {
      g.append("line").attr("x1",0).attr("x2",iW).attr("y1",yS(t)).attr("y2",yS(t))
        .attr("stroke","#ffffff06").attr("stroke-dasharray","2 6");
      g.append("text").attr("x",-6).attr("y",yS(t)+3).attr("text-anchor","end")
        .attr("fill","#2a4a6a").attr("font-size",8).text(t);
    });

    let running = 0;
    items.forEach((item, i) => {
      const bx = xS(item.label) ?? 0, bw = xS.bandwidth();
      const defs = svg.append("defs");
      const gid = `wf2_${i}`;
      const grad = defs.append("linearGradient").attr("id",gid).attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",1);
      grad.append("stop").attr("offset","0%").attr("stop-color",item.color).attr("stop-opacity",0.9);
      grad.append("stop").attr("offset","100%").attr("stop-color",item.color).attr("stop-opacity",0.2);

      const isSpecial = !item.isDelta;
      const start = isSpecial ? 0 : (item.val >= 0 ? running : running + item.val);
      const end   = isSpecial ? item.val : running + item.val;
      const top   = yS(Math.max(start, end));
      const bot   = yS(Math.min(start, end));
      const bh    = Math.max(bot - top, 2);

      if (!isSpecial) {
        g.append("line").attr("x1",bx-2).attr("x2",bx).attr("y1",yS(running)).attr("y2",yS(running))
          .attr("stroke","#ffffff15").attr("stroke-dasharray","2 3");
      }
      g.append("rect").attr("x",bx).attr("y",top).attr("width",bw).attr("height",bh)
        .attr("fill",`url(#${gid})`).attr("rx",2);
      g.append("rect").attr("x",bx).attr("y",top).attr("width",bw).attr("height",2)
        .attr("fill",item.color).attr("rx",1);
      g.append("text").attr("x",bx+bw/2).attr("y",top-5).attr("text-anchor","middle")
        .attr("fill",item.color).attr("font-size",9).attr("font-weight",900).attr("font-family","monospace")
        .text(item.isDelta ? `${item.val>=0?"+":""}${item.val.toFixed(0)}` : item.val.toFixed(0));
      g.append("text").attr("x",bx+bw/2).attr("y",iH+18).attr("text-anchor","middle")
        .attr("fill","#4a7a9a").attr("font-size",8).text(item.label);

      if (!isSpecial) running += item.val;
    });
  }, [region]);

  return (
    <div>
      <div style={{ fontSize:10, color:"#3a6a8a", letterSpacing:3, marginBottom:5 }}>2015→2025 DELTA WATERFALL</div>
      <svg ref={ref} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" />
    </div>
  );
}

// ─── STACKED AREA ─────────────────────────────────────────────────────────────
function StackedAreaChart({ regions }: { regions: RegionTrend[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hovYr, setHovYr] = useState<number | null>(null);
  const W = 540, H = 140;

  useEffect(() => {
    if (!ref.current || !regions.length) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    svg.attr("viewBox",`0 0 ${W} ${H}`);
    const m = { top:14, right:12, bottom:28, left:36 };
    const iW = W-m.left-m.right, iH = H-m.top-m.bottom;
    const g = svg.append("g").attr("transform",`translate(${m.left},${m.top})`);

    const xS = d3.scalePoint().domain(YEARS).range([0,iW]);
    const stackData = YEARS.map((yr, yi) => {
      const obj: Record<string, number> = { year: yi };
      regions.forEach(r => { obj[r.region] = r.data[yi]?.composite ?? 55; });
      return obj;
    });

    const keys = regions.map(r => r.region);
    const stack = d3.stack<Record<string,number>>().keys(keys).offset(d3.stackOffsetNone)(stackData);
    const yS = d3.scaleLinear().domain([0, d3.max(stack[stack.length-1], d=>d[1])!]).range([iH,0]);

    const defs = svg.append("defs");

    stack.forEach((layer, li) => {
      const region = regions.find(r=>r.region===layer.key)!;
      if (!region) return;
      const gid = `sa_${li}`;
      const grad = defs.append("linearGradient").attr("id",gid).attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",1);
      grad.append("stop").attr("offset","0%").attr("stop-color",region.color).attr("stop-opacity",0.7);
      grad.append("stop").attr("offset","100%").attr("stop-color",region.color).attr("stop-opacity",0.15);

      const area = d3.area<d3.SeriesPoint<Record<string,number>>>()
        .x((_,i) => xS(YEARS[i])!).y0(d => yS(d[0])).y1(d => yS(d[1])).curve(d3.curveCatmullRom);
      const line = d3.line<d3.SeriesPoint<Record<string,number>>>()
        .x((_,i) => xS(YEARS[i])!).y(d => yS(d[1])).curve(d3.curveCatmullRom);

      g.append("path").datum(layer).attr("d",area).attr("fill",`url(#${gid})`);
      g.append("path").datum(layer).attr("d",line).attr("fill","none")
        .attr("stroke",region.color).attr("stroke-width",1.5).attr("opacity",0.9);
    });

    YEARS.forEach((yr,i) => {
      if (i%2===0) g.append("text").attr("x",xS(yr)!).attr("y",iH+18).attr("text-anchor","middle")
        .attr("fill","#2a4a6a").attr("font-size",9).attr("font-family","monospace").text(yr.slice(2));
    });

    YEARS.forEach((yr,i) => {
      svg.append("rect").attr("x",m.left+xS(yr)!-15).attr("y",m.top).attr("width",30).attr("height",iH)
        .attr("fill","transparent").style("cursor","crosshair")
        .on("mouseover",() => setHovYr(i)).on("mouseout",() => setHovYr(null));
    });

    regions.forEach((r, i) => {
      g.append("rect").attr("x", iW - (regions.length-i)*72 + 8).attr("y",-12).attr("width",10).attr("height",6)
        .attr("fill",r.color).attr("rx",1);
      g.append("text").attr("x",iW-(regions.length-i)*72+22).attr("y",-7)
        .attr("fill",r.color).attr("font-size",9).attr("font-weight",700).attr("font-family","monospace")
        .text(r.region.slice(0,2).toUpperCase());
    });
  }, [regions, hovYr]);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
        <span style={{ fontSize:10, color:"#3a6a8a", letterSpacing:3 }}>STACKED REGIONAL SCORES</span>
        {hovYr !== null && (
          <span style={{ fontSize:10, color:"#00d4ff", fontFamily:"monospace" }}>
            ◆ {YEARS[hovYr]} — {regions.map(r => `${r.region.slice(0,2)}:${r.data[hovYr]?.composite.toFixed(0)}`).join(" · ")}
          </span>
        )}
      </div>
      <svg ref={ref} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" />
    </div>
  );
}

// ─── SCORE DISTRIBUTION VIOLIN ────────────────────────────────────────────────
function ScoreViolin({ states }: { states: StateData[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const W = 260, H = 110;

  useEffect(() => {
    if (!ref.current || !states.length) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const m = { top:10, right:16, bottom:24, left:8 };
    const iW = W-m.left-m.right, iH = H-m.top-m.bottom;
    const g = svg.append("g").attr("transform",`translate(${m.left},${m.top})`);

    const scores = states.map(s => Number(s.composite_score)).sort(d3.ascending);
    const xS = d3.scaleLinear().domain([0,100]).range([0,iW]);

    const bandwidth = 5;
    const kde = (kernel: (v: number) => number, thresholds: number[], data: number[]) =>
      thresholds.map(x => [x, d3.mean(data, d => kernel(x - d))!] as [number,number]);
    const epanechnikov = (bw: number) => (v: number) => Math.abs(v /= bw) <= 1 ? 0.75 * (1 - v * v) / bw : 0;
    const thresholds = d3.range(0,101,1);
    const density = kde(epanechnikov(bandwidth), thresholds, scores);
    const maxD = d3.max(density, d => d[1])!;
    const yS = d3.scaleLinear().domain([0, maxD]).range([iH/2, 0]);
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id","violin_grad").attr("x1",0).attr("x2",1);
    grad.append("stop").attr("offset","0%").attr("stop-color","#ff2d55").attr("stop-opacity",0.8);
    grad.append("stop").attr("offset","45%").attr("stop-color","#ff9500").attr("stop-opacity",0.8);
    grad.append("stop").attr("offset","65%").attr("stop-color","#00d4ff").attr("stop-opacity",0.8);
    grad.append("stop").attr("offset","100%").attr("stop-color","#00ff9d").attr("stop-opacity",0.8);

    const topArea = d3.area<[number,number]>().x(d=>xS(d[0])).y0(iH/2).y1(d=>yS(d[1])).curve(d3.curveCatmullRom);
    const botArea = d3.area<[number,number]>().x(d=>xS(d[0])).y0(iH/2).y1(d=>iH-yS(d[1])).curve(d3.curveCatmullRom);

    g.append("path").datum(density).attr("d",topArea).attr("fill","url(#violin_grad)").attr("opacity",0.7);
    g.append("path").datum(density).attr("d",botArea).attr("fill","url(#violin_grad)").attr("opacity",0.4);

    const q1 = d3.quantile(scores,0.25)!, q3 = d3.quantile(scores,0.75)!, median = d3.median(scores)!;
    g.append("rect").attr("x",xS(q1)).attr("y",iH/2-8).attr("width",xS(q3)-xS(q1)).attr("height",16)
      .attr("fill","rgba(0,212,255,0.12)").attr("stroke","rgba(0,212,255,0.4)").attr("stroke-width",1).attr("rx",2);
    g.append("line").attr("x1",xS(median)).attr("x2",xS(median)).attr("y1",iH/2-10).attr("y2",iH/2+10)
      .attr("stroke","#00d4ff").attr("stroke-width",2);
    g.append("text").attr("x",xS(median)).attr("y",iH/2-14).attr("text-anchor","middle")
      .attr("fill","#00d4ff").attr("font-size",9).attr("font-weight",800).attr("font-family","monospace")
      .text(`MED:${median.toFixed(0)}`);

    [0,25,50,75,100].forEach(t => {
      g.append("text").attr("x",xS(t)).attr("y",iH+16).attr("text-anchor","middle")
        .attr("fill","#2a4a6a").attr("font-size",8).attr("font-family","monospace").text(t);
      g.append("line").attr("x1",xS(t)).attr("x2",xS(t)).attr("y1",iH).attr("y2",iH+5)
        .attr("stroke","#1a3a5a").attr("stroke-width",1);
    });
  }, [states]);

  return (
    <div>
      <div style={{ fontSize:10, color:"#3a6a8a", letterSpacing:3, marginBottom:5 }}>SCORE DISTRIBUTION VIOLIN</div>
      <svg ref={ref} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" />
    </div>
  );
}

// ─── BUBBLE SCATTER ───────────────────────────────────────────────────────────
function BubbleScatter({ states, selectedState, onSelect }: {
  states: StateData[];
  selectedState: StateData | null;
  onSelect: (s: StateData) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const W = 380, H = 200;

  useEffect(() => {
    if (!ref.current || !states.length) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const m = { top:12, right:12, bottom:28, left:36 };
    const iW = W-m.left-m.right, iH = H-m.top-m.bottom;
    const g = svg.append("g").attr("transform",`translate(${m.left},${m.top})`);

    const xS = d3.scaleLinear().domain([0,100]).range([0,iW]);
    const yS = d3.scaleLinear().domain([0,100]).range([iH,0]);
    const rS = d3.scaleSqrt().domain([0, d3.max(states, s=>Number(s.population_2020))!]).range([3,18]);

    const defs = svg.append("defs");
    const glow = defs.append("filter").attr("id","bubble_glow");
    glow.append("feGaussianBlur").attr("stdDeviation","3").attr("result","blur");
    const fm = glow.append("feMerge");
    fm.append("feMergeNode").attr("in","blur");
    fm.append("feMergeNode").attr("in","SourceGraphic");

    [25,50,75].forEach(t => {
      g.append("line").attr("x1",xS(t)).attr("x2",xS(t)).attr("y1",0).attr("y2",iH)
        .attr("stroke","#ffffff06").attr("stroke-dasharray","2 8");
      g.append("line").attr("x1",0).attr("x2",iW).attr("y1",yS(t)).attr("y2",yS(t))
        .attr("stroke","#ffffff06").attr("stroke-dasharray","2 8");
    });

    states.forEach(s => {
      const cx = xS(Number(s.access_score));
      const cy = yS(Number(s.income_score));
      const r  = rS(Number(s.population_2020));
      const c  = scoreColor(Number(s.composite_score));
      const isSel = selectedState?.state_code === s.state_code;

      g.append("circle").attr("cx",cx).attr("cy",cy).attr("r",r+4)
        .attr("fill",c).attr("opacity",0.08).attr("pointer-events","none");
      g.append("circle").attr("cx",cx).attr("cy",cy).attr("r",r)
        .attr("fill",c).attr("opacity",isSel?0.95:0.55)
        .attr("stroke",isSel?"#fff":c).attr("stroke-width",isSel?2:0.5)
        .attr("filter",isSel?"url(#bubble_glow)":"none")
        .style("cursor","pointer")
        .on("click",()=>onSelect(s))
        .on("mouseover",function(){d3.select(this).attr("opacity",0.95).attr("filter","url(#bubble_glow)");})
        .on("mouseout",function(){d3.select(this).attr("opacity",isSel?0.95:0.55).attr("filter",isSel?"url(#bubble_glow)":"none");});

      if (isSel || r > 14) {
        g.append("text").attr("x",cx).attr("y",cy+3).attr("text-anchor","middle")
          .attr("fill","#fff").attr("font-size",8).attr("font-weight",800).attr("font-family","monospace")
          .attr("pointer-events","none").text(s.state_code);
      }
    });

    g.append("text").attr("x",iW/2).attr("y",iH+22).attr("text-anchor","middle")
      .attr("fill","#3a6a8a").attr("font-size",9).attr("font-family","monospace").text("ACCESS SCORE →");
    g.append("text").attr("transform",`translate(-28,${iH/2}) rotate(-90)`).attr("text-anchor","middle")
      .attr("fill","#3a6a8a").attr("font-size",9).attr("font-family","monospace").text("INCOME SCORE ↑");
  }, [states, selectedState]);

  return (
    <div>
      <div style={{ fontSize:10, color:"#3a6a8a", letterSpacing:3, marginBottom:5 }}>
        ACCESS vs INCOME · BUBBLE = POPULATION
      </div>
      <svg ref={ref} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible" }} />
    </div>
  );
}

// ─── MAIN TREND DASHBOARD ─────────────────────────────────────────────────────
export default function TrendDashboard() {
  const [states, setStates]     = useState<StateData[]>([]);
  const [stats, setStats]       = useState<NationalStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [now, setNow]           = useState(new Date());
  const [pulse, setPulse]       = useState(false);

  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedState, setSelectedState]   = useState<StateData | null>(null);
  const [hoveredRegion, setHoveredRegion]   = useState<RegionTrend | null>(null);
  const [hoverYear, setHoverYear]           = useState<string | null>(null);
  const [hoverVal, setHoverVal]             = useState<number | null>(null);
  const [activeFactor, setActiveFactor]     = useState<string>("composite");

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/etats`).then(r => r.json()),
      fetch(`${API_URL}/api/stats/national`).then(r => r.json()),
    ]).then(([sd, nd]) => {
      setStates(sd); setStats(nd);
      setSelectedState(sd[0] ?? null);
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setInterval(() => { setNow(new Date()); setPulse(p=>!p); }, 1000);
    return () => clearInterval(t);
  }, []);

  const regionTrends = useMemo(() => buildRegionTrends(states), [states]);

  const handleChartHover = useCallback((r: RegionTrend | null, yr?: string, val?: number) => {
    setHoveredRegion(r);
    setHoverYear(yr ?? null);
    setHoverVal(val ?? null);
  }, []);

  const handleToggleRegion = useCallback((r: Region | null) => {
    setSelectedRegion(prev => prev === r ? null : r);
  }, []);

  const natAvg     = stats ? Math.round(Number(stats.avg_score)) : 0;
  const critCount  = stats ? Number(stats.critical_count) : 0;
  const topCode    = stats?.top_state_code ?? "–";
  const dispersion = stats ? Math.round(Number(stats.dispersion)) : 0;
  const topRegion  = regionTrends.length ? regionTrends.reduce((a,b) => a.currentAvg > b.currentAvg ? a : b) : null;
  const globalVel  = regionTrends.length ? parseFloat((regionTrends.reduce((a,b)=>a+b.velocity,0)/regionTrends.length).toFixed(1)) : 0;
  const activeRegion = selectedRegion ? regionTrends.find(r=>r.region===selectedRegion) ?? null : null;

  const kpis = [
    { label:"NATIONAL AVG",    value:natAvg,    extra:`${states.length} states`,   color: natAvg>=50?"#00d4ff":"#ff9500", icon:"◈",               isNum:true },
    { label:"TREND VELOCITY",  value:globalVel, extra:globalVel>=0?"IMPROVING":"DECLINING", color:globalVel>=0?"#00ff9d":"#ff2d55", icon:globalVel>=0?"▲":"▼", isNum:true },
    { label:"CRITICAL STATES", value:critCount, extra:"Score < 50",                color:"#ff2d55", icon:"⚠",              isNum:true },
    { label:"SCORE SPREAD",    value:dispersion,extra:"Max−Min range",              color:"#ff9500", icon:"↔",              isNum:true },
    { label:"TOP REGION",      value:topRegion?.region.slice(0,2) ?? "–", extra:`AVG ${topRegion?.currentAvg}`, color:topRegion?.color??"#00ff9d", icon:"★", isNum:false },
    { label:"TOP STATE",       value:topCode,   extra:`Score ${stats?.max_score}`,  color:"#00ff9d", icon:"◉",              isNum:false },
  ];

  if (loading) return (
    <div style={{ minHeight:"calc(100vh - 64px)", background:"#020c1b", display:"flex", alignItems:"center",
      justifyContent:"center", flexDirection:"column", gap:16, fontFamily:"monospace" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:44,height:44,border:"2px solid rgba(0,229,255,0.2)",borderTop:"2px solid #00e5ff",
        borderRadius:"50%",animation:"spin 0.8s linear infinite" }} />
      <div style={{ color:"#00e5ff",fontSize:11,letterSpacing:4 }}>LOADING TREND ENGINE...</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight:"calc(100vh - 64px)", background:"#020c1b", display:"flex", alignItems:"center",
      justifyContent:"center", fontFamily:"monospace" }}>
      <div style={{ textAlign:"center", border:"1px solid rgba(255,45,85,0.3)", borderRadius:10, padding:36 }}>
        <div style={{ color:"#ff2d55",fontSize:14,marginBottom:12 }}>CONNECTION FAILURE</div>
        <div style={{ color:"rgba(180,210,255,0.5)",fontSize:12 }}>{error}</div>
      </div>
    </div>
  );

  return (
    // ✅ FIX 1 : plus de position:fixed ni overflow:hidden global qui cachait la navbar
    <div style={{
      minHeight:"calc(100vh - 64px)",   // ✅ laisse 64px pour la navbar
      background:"#020c1b",
      color:"#c0d8f0",
      fontFamily:"'JetBrains Mono','Fira Code',monospace",
      display:"flex",
      flexDirection:"column",
      position:"relative",              // ✅ relative au lieu de fixed
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-thumb{background:rgba(0,212,255,0.2);border-radius:2px;}
        @keyframes pulseRing{0%{transform:scale(.8);opacity:.6}100%{transform:scale(2.6);opacity:0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes scanLine{0%{transform:translateY(0)}100%{transform:translateY(100%)}}
        @keyframes shimmer{0%,100%{opacity:.7}50%{opacity:1}}
        .trend-card{animation:fadeIn 0.4s ease both;}
        .trend-row:hover{background:rgba(0,212,255,0.05)!important;}
        .region-btn:hover{filter:brightness(1.3);}
      `}</style>

      {/* ✅ FIX 2 : BG effects en position:absolute (pas fixed) + zIndex négatif pour ne pas couvrir la navbar */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0,
          background:"radial-gradient(ellipse 80% 40% at 20% 10%,rgba(0,45,90,0.5) 0%,transparent 55%),radial-gradient(ellipse 60% 50% at 85% 80%,rgba(80,0,140,0.25) 0%,transparent 55%),#020c1b" }} />
        <div style={{ position:"absolute", inset:0,
          backgroundImage:"linear-gradient(rgba(0,212,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.025) 1px,transparent 1px)",
          backgroundSize:"36px 36px" }} />
        <div style={{ position:"absolute",left:"8%",top:"15%",width:300,height:300,borderRadius:"50%",
          background:"rgba(0,200,255,0.04)",filter:"blur(50px)" }} />
        <div style={{ position:"absolute",right:"5%",bottom:"20%",width:250,height:250,borderRadius:"50%",
          background:"rgba(100,0,200,0.06)",filter:"blur(50px)" }} />
        <div style={{ position:"absolute",left:0,right:0,height:1,
          background:"linear-gradient(90deg,transparent,rgba(0,212,255,0.06),transparent)",
          animation:"scanLine 12s linear infinite" }} />
      </div>

      {/* KPI ROW */}
      <div style={{ position:"relative",zIndex:10,display:"grid",gridTemplateColumns:"repeat(6,1fr)",
        borderBottom:"1px solid #0d2540",background:"rgba(2,12,27,0.92)",backdropFilter:"blur(12px)" }}>
        {kpis.map((k,i) => (
          <div key={i} className="trend-card" style={{ padding:"12px 16px",
            borderRight:i<5?"1px solid #0d2540":"none",borderTop:`2px solid ${k.color}55`,
            animation:`fadeIn 0.35s ${i*0.07}s both` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5 }}>
              <span style={{ fontSize:9,color:"#3a6a8a",letterSpacing:2.5,fontWeight:700 }}>{k.label}</span>
              <span style={{ fontSize:14,color:k.color }}>{k.icon}</span>
            </div>
            <div style={{ fontSize:k.isNum?32:24,fontWeight:900,color:k.color,fontFamily:"monospace",lineHeight:1,marginBottom:3 }}>
              {k.isNum ? <AnimNumber value={k.value as number} decimals={Number.isInteger(k.value as number)?0:1} /> : k.value}
            </div>
            <div style={{ fontSize:9,color:"#2a4a6a",letterSpacing:1 }}>{k.extra}</div>
          </div>
        ))}
      </div>

      {/* MAIN LAYOUT */}
      <div style={{ position:"relative",zIndex:10,flex:1,display:"grid",
        gridTemplateColumns:"280px 1fr 300px",overflow:"hidden",minHeight:0 }}>

        {/* ─── LEFT PANEL ─── */}
        <div style={{ borderRight:"1px solid #0d2540",overflowY:"auto",
          display:"flex",flexDirection:"column",background:"rgba(2,12,27,0.8)" }}>

          <div style={{ padding:"14px 14px 10px",borderBottom:"1px solid #0d2540" }}>
            <div style={{ fontSize:10,color:"rgba(0,212,255,0.6)",letterSpacing:3,marginBottom:12,fontWeight:700 }}>
              ◈ REGION TRENDS
            </div>
            {regionTrends.map(r => {
              const isSel = selectedRegion === r.region;
              const velDir = r.velocity > 0.3 ? "▲" : r.velocity < -0.3 ? "▼" : "→";
              const velC   = r.velocity > 0.3 ? "#00ff9d" : r.velocity < -0.3 ? "#ff2d55" : "#ff9500";
              return (
                <div key={r.region} className="region-btn"
                  onClick={() => handleToggleRegion(r.region)}
                  style={{ padding:"10px 11px",marginBottom:7,borderRadius:8,cursor:"pointer",
                    background: isSel ? `${r.color}12` : "rgba(255,255,255,0.02)",
                    border:`1px solid ${isSel?r.color+"55":"rgba(255,255,255,0.06)"}`,
                    transition:"all 0.2s", boxShadow:isSel?`0 0 16px ${r.color}20`:"none" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <PulseDot color={r.color} size={7} />
                      <span style={{ fontSize:12,color:isSel?r.color:"rgba(180,210,255,0.7)",fontWeight:isSel?800:500 }}>
                        {r.region.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <span style={{ fontSize:10,color:velC,fontWeight:800 }}>{velDir}</span>
                      <span style={{ fontSize:15,fontWeight:900,color:r.color,fontFamily:"monospace" }}>{r.currentAvg}</span>
                    </div>
                  </div>
                  <MicroSpark data={r.data.map(d=>d.composite)} color={r.color} width={220} height={30} />
                  <div style={{ marginTop:6 }}>
                    <VelocityMeter velocity={r.velocity} color={r.color} />
                  </div>
                  <div style={{ marginTop:6,display:"flex",justifyContent:"space-between",fontSize:9,color:"#3a6a8a" }}>
                    <span>{r.states.length} states</span>
                    <span style={{ color:scoreColor(r.currentAvg) }}>{scoreTierLabel(r.currentAvg)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding:"12px 14px",borderBottom:"1px solid #0d2540" }}>
            <div style={{ fontSize:10,color:"rgba(0,212,255,0.6)",letterSpacing:3,marginBottom:10,fontWeight:700 }}>
              ⚙ FACTOR FOCUS
            </div>
            {[{key:"composite",label:"COMPOSITE",color:"#c0d8f0"},...FACTOR_META].map(f => {
              const isActive = activeFactor === f.key;
              return (
                <div key={f.key} onClick={() => setActiveFactor(f.key)}
                  style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
                    padding:"7px 10px",marginBottom:5,borderRadius:6,cursor:"pointer",
                    background:isActive?`${f.color}12`:"transparent",
                    border:`1px solid ${isActive?f.color+"44":"rgba(255,255,255,0.05)"}`,
                    transition:"all 0.2s" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <div style={{ width:8,height:8,borderRadius:2,background:f.color,
                      boxShadow:isActive?`0 0 6px ${f.color}`:"none" }} />
                    <span style={{ fontSize:10,color:isActive?f.color:"#5a8aaa",fontWeight:isActive?700:400,letterSpacing:1 }}>
                      {f.label}
                    </span>
                  </div>
                  {isActive && <span style={{ fontSize:9,color:f.color,opacity:0.7 }}>● ACTIVE</span>}
                </div>
              );
            })}
          </div>

          <div style={{ padding:"12px 14px",borderBottom:"1px solid #0d2540",flex:1 }}>
            <div style={{ fontSize:10,color:"rgba(0,212,255,0.6)",letterSpacing:3,marginBottom:10,fontWeight:700 }}>
              🔍 STATE SPOTLIGHT
            </div>
            <div style={{ maxHeight:220,overflowY:"auto" }}>
              {[...states].sort((a,b)=>Number(b.composite_score)-Number(a.composite_score)).slice(0,20).map(s => {
                const sc = Math.round(Number(s.composite_score));
                const isSel = selectedState?.state_code === s.state_code;
                return (
                  <div key={s.state_code} className="trend-row"
                    onClick={() => setSelectedState(s)}
                    style={{ display:"flex",alignItems:"center",gap:8,padding:"7px 8px",
                      borderRadius:6,cursor:"pointer",marginBottom:3,
                      background:isSel?"rgba(0,212,255,0.08)":"transparent",
                      border:`1px solid ${isSel?"rgba(0,212,255,0.25)":"transparent"}`,
                      transition:"all 0.15s" }}>
                    <span style={{ fontSize:11,fontWeight:800,color:scoreColor(sc),width:28 }}>{s.state_code}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ height:3,background:"rgba(255,255,255,0.05)",borderRadius:2,overflow:"hidden" }}>
                        <div style={{ height:"100%",width:`${sc}%`,background:scoreColor(sc),borderRadius:2 }} />
                      </div>
                    </div>
                    <span style={{ fontSize:12,fontWeight:900,color:scoreColor(sc),fontFamily:"monospace",width:24,textAlign:"right" }}>{sc}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {states.length > 0 && (
            <div style={{ padding:"12px 14px" }}>
              <ScoreViolin states={states} />
            </div>
          )}
        </div>

        {/* ─── CENTER PANEL ─── */}
        <div style={{ display:"flex",flexDirection:"column",background:"rgba(2,12,27,0.7)",overflow:"hidden" }}>

          <div style={{ padding:"10px 18px",display:"flex",justifyContent:"space-between",
            alignItems:"center",borderBottom:"1px solid #0d2540",flexShrink:0 }}>
            <div>
              <div style={{ fontSize:10,color:"#3a6a8a",letterSpacing:3 }}>TEMPORAL ANALYSIS ENGINE</div>
              <div style={{ fontSize:16,fontWeight:800,color:"#e0f4ff",marginTop:2 }}>
                FOOD RESILIENCE · TREND INTELLIGENCE
              </div>
            </div>
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              {hoveredRegion && hoverYear && (
                <div style={{ padding:"5px 14px",borderRadius:7,
                  background:`${hoveredRegion.color}14`,border:`1px solid ${hoveredRegion.color}40`,
                  fontSize:11,color:hoveredRegion.color,fontWeight:800 }}>
                  {hoveredRegion.region} · {hoverYear} → {hoverVal?.toFixed(1)}
                </div>
              )}
              <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                <div style={{ width:8,height:8,borderRadius:"50%",background:"#00d97e",
                  boxShadow:pulse?"0 0 10px #00d97e":"none",transition:"box-shadow 0.5s" }} />
                <span style={{ fontSize:9,color:"#00d97e",letterSpacing:2 }}>LIVE</span>
              </div>
              <span style={{ fontSize:10,color:"#3a6a8a" }}>
                {now.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
              </span>
            </div>
          </div>

          <div style={{ flex:"0 0 320px",position:"relative",padding:"8px 8px 0" }}>
            <RibbonTrendChart regions={regionTrends} selectedRegion={selectedRegion} onHover={handleChartHover} />
          </div>

          <div style={{ padding:"6px 18px",borderTop:"1px solid #0d2540",display:"flex",
            gap:14,alignItems:"center",flexShrink:0 }}>
            {regionTrends.map(r => (
              <div key={r.region} onClick={() => handleToggleRegion(r.region)}
                style={{ display:"flex",alignItems:"center",gap:7,cursor:"pointer",
                  opacity:selectedRegion && selectedRegion!==r.region?0.35:1,transition:"opacity 0.2s" }}>
                <div style={{ width:16,height:3,borderRadius:2,background:r.color }} />
                <span style={{ fontSize:10,color:r.color,fontWeight:700,letterSpacing:1 }}>{r.region.toUpperCase()}</span>
                <span style={{ fontSize:11,color:r.color,fontFamily:"monospace",fontWeight:900 }}>{r.currentAvg}</span>
              </div>
            ))}
            <div style={{ marginLeft:"auto",fontSize:9,color:"#1a3a5a",letterSpacing:2 }}>
              2015–2025 · {states.length} STATES
            </div>
          </div>

          <div style={{ padding:"10px 16px",borderTop:"1px solid #0d2540",flexShrink:0 }}>
            <StackedAreaChart regions={regionTrends} />
          </div>

          <div style={{ padding:"10px 16px",borderTop:"1px solid #0d2540",flex:1,overflow:"auto" }}>
            <div style={{ fontSize:10,color:"#3a6a8a",letterSpacing:3,marginBottom:8,fontWeight:700 }}>
              TEMPORAL HEATMAP · CLICK REGION TO FILTER
            </div>
            <HeatMatrix regions={regionTrends} selectedRegion={selectedRegion} onSelect={r => handleToggleRegion(r)} />
          </div>
        </div>

        {/* ─── RIGHT PANEL ─── */}
        <div style={{ borderLeft:"1px solid #0d2540",overflowY:"auto",
          display:"flex",flexDirection:"column",background:"rgba(2,12,27,0.85)" }}>

          {selectedState && (
            <div style={{ padding:"14px 14px",borderBottom:"1px solid #0d2540" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:15,fontWeight:800,color:"#e0f4ff" }}>{selectedState.state_name}</div>
                  <div style={{ fontSize:9,color:"#3a6a8a",letterSpacing:2,marginTop:1 }}>
                    {selectedState.state_code} · {selectedState.region}
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:24,fontWeight:900,fontFamily:"monospace",
                    color:scoreColor(Math.round(Number(selectedState.composite_score))) }}>
                    <AnimNumber value={Math.round(Number(selectedState.composite_score))} />
                  </div>
                  <div style={{ fontSize:9,color:scoreColor(Math.round(Number(selectedState.composite_score))),letterSpacing:1.5 }}>
                    {scoreTierLabel(Math.round(Number(selectedState.composite_score)))}
                  </div>
                </div>
              </div>
              <RadialBurst state={selectedState} />
            </div>
          )}

          {selectedState && (
            <div style={{ padding:"12px 14px",borderBottom:"1px solid #0d2540" }}>
              <div style={{ fontSize:10,color:"#3a6a8a",letterSpacing:3,marginBottom:10,fontWeight:700 }}>
                FACTOR BREAKDOWN
              </div>
              {FACTOR_META.map(f => {
                const v = Math.round(Number(selectedState[f.key as keyof StateData] ?? 50));
                return (
                  <div key={f.key} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                      <span style={{ fontSize:10,color:f.color,fontWeight:700,letterSpacing:1 }}>{f.label}</span>
                      <span style={{ fontSize:12,color:f.color,fontFamily:"monospace",fontWeight:900 }}>{v}</span>
                    </div>
                    <div style={{ height:5,background:"rgba(255,255,255,0.05)",borderRadius:3,overflow:"hidden" }}>
                      <div style={{ height:"100%",width:`${v}%`,background:`linear-gradient(90deg,${f.color}80,${f.color})`,
                        borderRadius:3,transition:"width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeRegion && (
            <div style={{ padding:"12px 14px",borderBottom:"1px solid #0d2540" }}>
              <WaterfallDecomp region={activeRegion} />
            </div>
          )}

          {states.length > 0 && (
            <div style={{ padding:"12px 14px",borderBottom:"1px solid #0d2540" }}>
              <BubbleScatter states={states} selectedState={selectedState} onSelect={setSelectedState} />
            </div>
          )}

          <div style={{ padding:"12px 14px",borderBottom:"1px solid #0d2540" }}>
            <div style={{ fontSize:10,color:"rgba(0,212,255,0.6)",letterSpacing:3,marginBottom:10,fontWeight:700 }}>
              ⚡ TREND LEADERS
            </div>
            {[...states].sort((a,b)=>Number(b.composite_score)-Number(a.composite_score)).slice(0,6).map((s,i) => {
              const sc = Math.round(Number(s.composite_score));
              const mini = buildTrendPoints(sc, 4).map(d => d.composite);
              const vel  = mini.length >= 3 ? parseFloat(((mini[mini.length-1]-mini[mini.length-3])/2).toFixed(1)) : 0;
              const vc   = vel > 0 ? "#00ff9d" : vel < 0 ? "#ff2d55" : "#ff9500";
              return (
                <div key={s.state_code} onClick={() => setSelectedState(s)}
                  style={{ display:"flex",alignItems:"center",gap:9,marginBottom:7,
                    padding:"8px 10px",borderRadius:7,cursor:"pointer",
                    background:selectedState?.state_code===s.state_code?"rgba(0,212,255,0.07)":"rgba(255,255,255,0.02)",
                    border:`1px solid ${selectedState?.state_code===s.state_code?"rgba(0,212,255,0.2)":"rgba(255,255,255,0.04)"}`,
                    transition:"all 0.15s" }}>
                  <span style={{ fontSize:10,color:"#1e3a52",width:14,fontWeight:700 }}>#{i+1}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11,color:"rgba(255,255,255,0.7)",fontWeight:600 }}>{s.state_name}</div>
                    <div style={{ fontSize:9,color:"#3a6a8a" }}>{s.region}</div>
                  </div>
                  <MicroSpark data={mini.slice(-6)} color={scoreColor(sc)} width={56} height={22} />
                  <div style={{ textAlign:"right",minWidth:44 }}>
                    <div style={{ fontFamily:"monospace",fontSize:15,fontWeight:900,color:scoreColor(sc) }}>{sc}</div>
                    <div style={{ fontSize:10,color:vc,fontFamily:"monospace",fontWeight:700 }}>
                      {vel>0?"+":""}{vel}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding:"12px 14px" }}>
            <div style={{ fontSize:10,color:"#3a6a8a",letterSpacing:3,marginBottom:10,fontWeight:700 }}>
              RISK TIER DISTRIBUTION
            </div>
            {[
              {label:"RESILIENT ≥65", color:"#00ff9d", count:states.filter(s=>Number(s.composite_score)>=65).length},
              {label:"MODERATE 50–64",color:"#00d4ff", count:states.filter(s=>Number(s.composite_score)>=50&&Number(s.composite_score)<65).length},
              {label:"HIGH RISK 40–49",color:"#ff9500",count:states.filter(s=>Number(s.composite_score)>=40&&Number(s.composite_score)<50).length},
              {label:"CRITICAL <40",  color:"#ff2d55", count:states.filter(s=>Number(s.composite_score)<40).length},
            ].map(tier => {
              const pct = states.length ? Math.round((tier.count/states.length)*100) : 0;
              return (
                <div key={tier.label} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                    <span style={{ fontSize:10,color:tier.color,fontWeight:700 }}>{tier.label}</span>
                    <span style={{ fontSize:11,fontFamily:"monospace",color:tier.color,fontWeight:900 }}>
                      {tier.count} <span style={{ fontSize:9,opacity:0.7 }}>({pct}%)</span>
                    </span>
                  </div>
                  <div style={{ height:5,background:"rgba(255,255,255,0.04)",borderRadius:3,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:`${pct}%`,
                      background:`linear-gradient(90deg,${tier.color}60,${tier.color})`,
                      borderRadius:3,transition:"width 0.8s ease",
                      boxShadow:`0 0 6px ${tier.color}55` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ position:"relative",zIndex:10,borderTop:"1px solid #0d2540",
        padding:"5px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",
        background:"rgba(2,12,27,0.95)",fontSize:9,color:"#1a3a5a",letterSpacing:2,flexShrink:0 }}>
        <span>FOOD RESILIENCE INTELLIGENCE · TREND MODULE · CPI · ACCESS · TRANSIT · INCOME</span>
        <span style={{ color:"#00d97e44" }}>● POSTGRESQL · {states.length} STATES · 2015–2025</span>
        <span>© 2026 INTELLIGENCE PLATFORM</span>
      </div>
    </div>
  );
}