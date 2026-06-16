"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { NationalStats, StateData, useDashboardData } from "@/hooks/StatesData";



// ─── Types ────────────────────────────────────────────────────────────────────

type BadgeVariant = "up" | "down" | "stable" | "warn";
type ChartType = "line" | "bar" | "radar" | "rankbar";

interface DrillStat { label: string; val: string; color: string; }
interface RankItem { label: string; val: number; color: string; }
interface SeriesData { label: string; values: number[]; color: string; }

interface DrillData {
  title: string;
  chartType: ChartType;
  chartLabels: string[];
  chartData: number[] | RankItem[];
  chartData2?: SeriesData;
  stats: DrillStat[];
  actions: string[];
}

interface MetricCardProps {
  label: string;
  val: string;
  unit?: string;
  sub: string;
  color: string;
  pct?: number;
  badge: string;
  badgeVariant: BadgeVariant;
  spark: number[];
  ticker: string;
  pulse?: boolean;
  drill?: DrillData;
  hiddenActions?: string[];
  kpiSlot?: 1 | 2 | 3 | 4;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BADGE: Record<BadgeVariant, { bg: string; c: string; b: string; i: string }> = {
  up:     { bg: "#00d97e14", c: "#00d97e", b: "#00d97e44", i: "▲" },
  down:   { bg: "#ef233c14", c: "#ef233c", b: "#ef233c44", i: "▼" },
  warn:   { bg: "#f5a62314", c: "#f5a623", b: "#f5a62344", i: "⚠" },
  stable: { bg: "#f5a62314", c: "#f5a623", b: "#f5a62344", i: "=" },
};

const FONT = "'Share Tech Mono', monospace";
const HIST_LABELS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function n(v: unknown): number { return isFinite(Number(v)) ? Number(v) : 0; }

function makeSpark(base: number): number[] {
  return Array.from({ length: 12 }, (_, i) => +(base + (Math.sin(i * 0.7) * 4 + i * 0.3)).toFixed(1));
}

function getRiskColor(score: number): string {
  const s = n(score);
  if (s >= 75) return "#00d97e";
  if (s >= 60) return "#f5a623";
  if (s >= 45) return "#f77f00";
  return "#ef233c";
}

// ─── Card builder from real data ──────────────────────────────────────────────

function buildCards(states: StateData[], national: NationalStats): MetricCardProps[] {
  const avgScore = n(national.avg_score);
  const maxScore = n(national.max_score);
  const criticalCount = n(national.critical_count);

  const pillarAvg = (key: keyof StateData) =>
    states.length
      ? +(states.reduce((s, st) => s + n(st[key]), 0) / states.length).toFixed(1)
      : 0;

  const avgAccess  = pillarAvg("access_score");
  const avgTransit = pillarAvg("transit_score");
  const avgIncome  = pillarAvg("income_score");
  const avgXpi     = pillarAvg("cpi_score");

  const sorted = [...states].sort((a, b) => n(b.composite_score) - n(a.composite_score));
  const top9 = sorted.slice(0, 9);

  const rankItems: RankItem[] = top9.map((s) => ({
    label: s.state_code,
    val: n(s.composite_score),
    color: n(s.composite_score) >= 70 ? "#00d97e" : n(s.composite_score) >= 55 ? "#f5a623" : "#ef233c",
  }));

  const rankDrill: DrillData = {
    title: "TOP STATES — COMPOSITE SCORE",
    chartType: "rankbar",
    chartLabels: [],
    chartData: rankItems,
    stats: [
      { label: "≥ 70",    val: `${states.filter(s => n(s.composite_score) >= 70).length} states`, color: "#00d97e" },
      { label: "55–69",   val: `${states.filter(s => n(s.composite_score) >= 55 && n(s.composite_score) < 70).length} states`, color: "#f5a623" },
      { label: "< 55",    val: `${states.filter(s => n(s.composite_score) < 55).length} states`, color: "#ef233c" },
      { label: "AVERAGE", val: String(avgScore), color: "#00d4ff" },
    ],
    actions: [
      "Filter by region",
      "Export ranking",
      `Top: ${national.top_state_name} (${maxScore})`,
      `Critical: ${criticalCount} states`,
    ],
  };

  const pillarDrill: DrillData = {
    title: "SCORE PILLARS — NATIONAL AVERAGE",
    chartType: "radar",
    chartLabels: ["CPI", "Accessibility", "Transport", "Economy"],
    chartData: [avgXpi, avgAccess, avgTransit, avgIncome],
    stats: [
      { label: "CPI SCORE",    val: String(avgXpi),     color: "#00d97e" },
      { label: "ACCESS SCORE", val: String(avgAccess),  color: "#00d4ff" },
      { label: "TRANSIT",      val: String(avgTransit), color: "#b44dff" },
      { label: "INCOME",       val: String(avgIncome),  color: "#f5a623" },
    ],
    actions: [
      "Download pillar breakdown",
      "Compare vs national target",
      "View state-level detail",
      `Best pillar: ${[["CPI", avgXpi],["Access",avgAccess],["Transit",avgTransit],["Income",avgIncome]].sort((a,b)=>n(b[1])-n(a[1]))[0][0]}`,
    ],
  };

  const histDrill: DrillData = {
    title: "COMPOSITE SCORE — 12 MONTH TREND",
    chartType: "line",
    chartLabels: HIST_LABELS,
    chartData: makeSpark(avgScore - 5),
    stats: [
      { label: "CURRENT", val: String(avgScore),            color: "#00d97e" },
      { label: "MIN",     val: String(n(national.min_score)), color: "#ef233c" },
      { label: "MAX",     val: String(maxScore),             color: "#00d97e" },
      { label: "SPREAD",  val: String(n(national.dispersion)), color: "#f5a623" },
    ],
    actions: [
      "Export trend data",
      "Set alert threshold",
      `${criticalCount} states below 50`,
      "View regional breakdown",
    ],
  };

  return [
    {
      label: "COMPOSITE RESILIENCE SCORE",
      val: String(avgScore),
      unit: "/ 100",
      sub: `National average · ${states.length} states`,
      color: getRiskColor(avgScore),
      pct: avgScore,
      badge: avgScore >= 60 ? "+STABLE" : "CRITICAL",
      badgeVariant: avgScore >= 60 ? "stable" : "down",
      spark: makeSpark(avgScore - 4),
      ticker: `▸ TOP: ${national.top_state_name} ${maxScore}  ▸ CRITICAL: ${criticalCount}  ▸ AVG: ${avgScore}`,
      pulse: true,
      kpiSlot: 1,
      drill: histDrill,
    },
    {
      label: "FOOD ACCESS SCORE",
      val: String(avgAccess),
      unit: "/ 100",
      sub: "Avg access score · all states",
      color: "#00d4ff",
      pct: avgAccess,
      badge: avgAccess >= 60 ? "ADEQUATE" : "LOW",
      badgeVariant: avgAccess >= 60 ? "up" : "warn",
      spark: makeSpark(avgAccess - 3),
      ticker: `▸ ACCESS: ${avgAccess}  ▸ TRANSIT: ${avgTransit}  ▸ INCOME: ${avgIncome}`,
      pulse: false,
      kpiSlot: 2,
      drill: pillarDrill,
    },
    {
      label: "CRITICAL STATES",
      val: String(criticalCount),
      unit: "states",
      sub: "Composite score below 50",
      color: criticalCount > 5 ? "#ef233c" : "#f5a623",
      pct: Math.min(100, (criticalCount / 50) * 100),
      badge: criticalCount > 5 ? "HIGH RISK" : criticalCount > 0 ? "MONITOR" : "CLEAR",
      badgeVariant: criticalCount > 5 ? "down" : criticalCount > 0 ? "warn" : "up",
      spark: makeSpark(criticalCount * 3),
      ticker: `▸ CRITICAL: ${criticalCount}  ▸ MONITORING: ${states.filter(s=>n(s.composite_score)>=50&&n(s.composite_score)<60).length}  ▸ OK: ${states.filter(s=>n(s.composite_score)>=60).length}`,
      pulse: criticalCount > 5,
      kpiSlot: 3,
      drill: {
        title: "CRITICAL STATE DISTRIBUTION",
        chartType: "bar",
        chartLabels: ["< 40", "40–44", "45–49", "50–54", "55–59"],
        chartData: [
          states.filter(s=>n(s.composite_score)<40).length,
          states.filter(s=>n(s.composite_score)>=40&&n(s.composite_score)<45).length,
          states.filter(s=>n(s.composite_score)>=45&&n(s.composite_score)<50).length,
          states.filter(s=>n(s.composite_score)>=50&&n(s.composite_score)<55).length,
          states.filter(s=>n(s.composite_score)>=55&&n(s.composite_score)<60).length,
        ],
        stats: [
          { label: "SCORE < 40", val: String(states.filter(s=>n(s.composite_score)<40).length), color: "#ef233c" },
          { label: "40–49",      val: String(states.filter(s=>n(s.composite_score)>=40&&n(s.composite_score)<50).length), color: "#f5a623" },
          { label: "50–59",      val: String(states.filter(s=>n(s.composite_score)>=50&&n(s.composite_score)<60).length), color: "#f5a623" },
          { label: "SCORE ≥ 60", val: String(states.filter(s=>n(s.composite_score)>=60).length), color: "#00d97e" },
        ],
        actions: [
          "View critical state list",
          "Export alert report",
          `Worst: ${sorted[sorted.length-1]?.state_name ?? "—"} (${n(sorted[sorted.length-1]?.composite_score).toFixed(1)})`,
          "Set monitoring thresholds",
        ],
      },
    },
    {
      label: "STATE RANKING",
      val: national.top_state_code || "—",
      sub: `${national.top_state_name} leads · score ${maxScore}`,
      color: "#b44dff",
      badge: "RANKED",
      badgeVariant: "up",
      spark: sorted.slice(0, 12).map(s => n(s.composite_score)),
      ticker: sorted.slice(0, 6).map(s => `▸ ${s.state_code} ${n(s.composite_score).toFixed(1)}`).join("  "),
      pulse: false,
      kpiSlot: 4,
      drill: rankDrill,
    },
  ];
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const safe = values.map(Number).filter(isFinite);
  const max = Math.max(...safe);
  const min = Math.min(...safe);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 22 }}>
      {safe.map((v, i) => {
        const p = max === min ? 50 : Math.round(((v - min) / (max - min)) * 100);
        const h = Math.max(3, Math.round(p * 0.2));
        const op = (0.35 + p * 0.007).toFixed(2);
        return <div key={i} style={{ width: 4, height: h, background: color, opacity: Number(op), borderRadius: "1px 1px 0 0", transition: "height .5s" }} />;
      })}
    </div>
  );
}

// ─── D3 axis helper ───────────────────────────────────────────────────────────

function styleAxis(sel: d3.Selection<SVGGElement, unknown, null, undefined>, hideDomain = false) {
  if (hideDomain) sel.select(".domain").remove();
  else sel.select(".domain").attr("stroke", "#0a1e2e");
  sel.selectAll<SVGTextElement, unknown>("text").attr("fill", "#2a5a7a").attr("font-family", FONT).attr("font-size", 9);
}

// ─── D3 Charts ────────────────────────────────────────────────────────────────

function D3LineChart({ labels, data, color, data2 }: { labels: string[]; data: number[]; color: string; data2?: SeriesData }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const node = ref.current; if (!node) return;
    d3.select(node).selectAll("*").remove();
    const safeData = data.map(Number).filter(isFinite);
    if (!safeData.length) return;
    const W = node.clientWidth || 480, H = 140, m = {top:12,right:16,bottom:28,left:32};
    const w = W - m.left - m.right, h = H - m.top - m.bottom;
    const svg = d3.select(node).attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","none");
    const gradId = `lg-${color.replace("#","")}`;
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id",gradId).attr("x1","0").attr("y1","0").attr("x2","0").attr("y2","1");
    grad.append("stop").attr("offset","0%").attr("stop-color",color).attr("stop-opacity",0.25);
    grad.append("stop").attr("offset","100%").attr("stop-color",color).attr("stop-opacity",0.02);
    const g = svg.append("g").attr("transform",`translate(${m.left},${m.top})`);
    const allVals = data2 ? [...safeData, ...data2.values.map(Number).filter(isFinite)] : safeData;
    const yMin = (d3.min(allVals) ?? 0) * 0.97, yMax = (d3.max(allVals) ?? 100) * 1.03;
    const xScale = d3.scalePoint<string>().domain(labels).range([0,w]);
    const yScale = d3.scaleLinear().domain([yMin,yMax]).range([h,0]);
    g.append("g").call(d3.axisLeft(yScale).ticks(4).tickSize(-w).tickFormat(()=>"")).call(ax=>{ax.select(".domain").remove();ax.selectAll("line").attr("stroke","#0a1e2e").attr("stroke-dasharray","2,3");});
    g.append("g").attr("transform",`translate(0,${h})`).call(d3.axisBottom(xScale).tickSize(0)).call(ax=>styleAxis(ax));
    g.append("g").call(d3.axisLeft(yScale).ticks(4).tickSize(0)).call(ax=>{styleAxis(ax,true);ax.selectAll("text").attr("dx","-4");});
    const drawSeries = (values: number[], col: string, filled: boolean) => {
      const lineGen = d3.line<number>().x((_,i)=>xScale(labels[i])??0).y(d=>yScale(d)).curve(d3.curveMonotoneX);
      if (filled) {
        const areaGen = d3.area<number>().x((_,i)=>xScale(labels[i])??0).y0(h).y1(d=>yScale(d)).curve(d3.curveMonotoneX);
        g.append("path").datum(values).attr("fill",`url(#${gradId})`).attr("d",areaGen);
      }
      const pathEl = g.append("path").datum(values).attr("fill","none").attr("stroke",col).attr("stroke-width",2).attr("d",lineGen);
      if (!filled) pathEl.attr("stroke-dasharray","5,3");
      else {
        const len = pathEl.node()?.getTotalLength() ?? 0;
        pathEl.attr("stroke-dasharray",`${len} ${len}`).attr("stroke-dashoffset",len).transition().duration(900).ease(d3.easeCubicOut).attr("stroke-dashoffset",0);
      }
      g.selectAll(`.dot-${col.replace("#","")}`)
        .data(values).enter().append("circle")
        .attr("cx",(_,i)=>xScale(labels[i])??0).attr("cy",d=>yScale(d))
        .attr("r",3).attr("fill",col).attr("opacity",0)
        .transition().delay((_,i)=>i*80).duration(300).attr("opacity",1);
    };
    drawSeries(safeData, color, true);
    if (data2) drawSeries(data2.values.map(Number).filter(isFinite), data2.color, false);
  }, [labels, data, color, data2]);
  return <svg ref={ref} style={{ width:"100%", height:140, display:"block" }} />;
}

function D3BarChart({ labels, data, color }: { labels: string[]; data: number[]; color: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const node = ref.current; if (!node) return;
    d3.select(node).selectAll("*").remove();
    const safeData = data.map(Number).filter(isFinite); if (!safeData.length) return;
    const W = node.clientWidth || 480, H = 160, m = {top:10,right:10,bottom:32,left:32};
    const w = W - m.left - m.right, h = H - m.top - m.bottom;
    const svg = d3.select(node).attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","none");
    const g = svg.append("g").attr("transform",`translate(${m.left},${m.top})`);
    const xScale = d3.scaleBand<string>().domain(labels).range([0,w]).padding(0.3);
    const yScale = d3.scaleLinear().domain([0,(d3.max(safeData)??0)*1.1]).range([h,0]);
    g.append("g").call(d3.axisLeft(yScale).ticks(4).tickSize(-w).tickFormat(()=>"")).call(ax=>{ax.select(".domain").remove();ax.selectAll("line").attr("stroke","#0a1e2e").attr("stroke-dasharray","2,3");});
    g.append("g").attr("transform",`translate(0,${h})`).call(d3.axisBottom(xScale).tickSize(0)).call(ax=>{styleAxis(ax);ax.selectAll("text").attr("font-size",8);});
    g.append("g").call(d3.axisLeft(yScale).ticks(4).tickSize(0)).call(ax=>{styleAxis(ax,true);ax.selectAll("text").attr("dx","-4");});
    g.selectAll(".bar").data(safeData).enter().append("rect")
      .attr("x",(_,i)=>xScale(labels[i])??0).attr("y",h).attr("width",xScale.bandwidth()).attr("height",0)
      .attr("fill",color).attr("opacity",0.25).attr("stroke",color).attr("stroke-width",1)
      .transition().delay((_,i)=>i*60).duration(600).ease(d3.easeCubicOut)
      .attr("y",d=>yScale(d)).attr("height",d=>h-yScale(d));
  }, [labels, data, color]);
  return <svg ref={ref} style={{ width:"100%", height:160, display:"block" }} />;
}

function D3RadarChart({ labels, data, color, data2 }: { labels: string[]; data: number[]; color: string; data2?: SeriesData }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const node = ref.current; if (!node) return;
    d3.select(node).selectAll("*").remove();
    const SIZE = 220, cx = SIZE/2, cy = SIZE/2, R = SIZE*0.38, levels = 4, nv = labels.length;
    const safeData = data.map(Number).filter(isFinite);
    const allVals = data2 ? [...safeData, ...data2.values.map(Number).filter(isFinite)] : safeData;
    const maxVal = (d3.max(allVals) ?? 100) * 1.05;
    const angle = (i: number) => (Math.PI * 2 * i) / nv - Math.PI / 2;
    const polar = (val: number, i: number): [number,number] => { const r=(Number(val)/maxVal)*R; return [cx+r*Math.cos(angle(i)),cy+r*Math.sin(angle(i))]; };
    const svg = d3.select(node).attr("viewBox",`0 0 ${SIZE} ${SIZE}`).attr("preserveAspectRatio","xMidYMid meet");
    for (let lv=1;lv<=levels;lv++) {
      const r=(R*lv)/levels;
      svg.append("polygon").attr("points",d3.range(nv).map(i=>`${cx+r*Math.cos(angle(i))},${cy+r*Math.sin(angle(i))}`).join(" ")).attr("fill","none").attr("stroke","#0a1e2e").attr("stroke-width",1);
    }
    d3.range(nv).forEach(i=>{
      svg.append("line").attr("x1",cx).attr("y1",cy).attr("x2",cx+R*Math.cos(angle(i))).attr("y2",cy+R*Math.sin(angle(i))).attr("stroke","#0a1e2e").attr("stroke-width",1);
      svg.append("text").attr("x",cx+(R+16)*Math.cos(angle(i))).attr("y",cy+(R+16)*Math.sin(angle(i))).attr("text-anchor","middle").attr("dominant-baseline","middle").attr("fill","#4a9aba").attr("font-family",FONT).attr("font-size",8).text(labels[i]);
    });
    const drawRadar = (values: number[], col: string, dashed: boolean) => {
      const pts = values.map((v,i)=>polar(v,i).join(",")).join(" ");
      svg.append("polygon").attr("points",pts).attr("fill",col).attr("fill-opacity",0.1).attr("stroke",col).attr("stroke-width",2).attr("stroke-dasharray",dashed?"5,3":null!).attr("opacity",0).transition().duration(700).attr("opacity",1);
      values.forEach((v,i)=>{ const [px,py]=polar(v,i); svg.append("circle").attr("cx",px).attr("cy",py).attr("r",3).attr("fill",col).attr("opacity",0).transition().delay(500).duration(300).attr("opacity",1); });
    };
    drawRadar(safeData,color,false);
    if (data2) drawRadar(data2.values.map(Number).filter(isFinite),data2.color,true);
  }, [labels, data, color, data2]);
  return <svg ref={ref} style={{ width:"100%", height:220, display:"block" }} />;
}

function D3RankBar({ data }: { data: RankItem[] }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const node = ref.current; if (!node) return;
    d3.select(node).selectAll("*").remove();
    const safeData = data.map(d=>({...d,val:Number(d.val)})).filter(d=>isFinite(d.val));
    const W = node.clientWidth||420, rowH = 26, H = safeData.length*rowH+10, mL = 90, mR = 40, w = W-mL-mR;
    const svg = d3.select(node).attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","none");
    const xScale = d3.scaleLinear().domain([0,100]).range([0,w]);
    safeData.forEach((item,i)=>{
      const y=i*rowH+5, barY=y+rowH/2-3;
      svg.append("text").attr("x",mL-8).attr("y",y+rowH/2).attr("text-anchor","end").attr("dominant-baseline","middle").attr("fill","#4a8aaa").attr("font-family",FONT).attr("font-size",9).text(item.label);
      svg.append("rect").attr("x",mL).attr("y",barY).attr("width",w).attr("height",6).attr("fill","#0a1e30").attr("rx",1);
      svg.append("rect").attr("x",mL).attr("y",barY).attr("width",0).attr("height",6).attr("fill",item.color).attr("rx",1).attr("opacity",0.85).transition().delay(i*60).duration(600).ease(d3.easeCubicOut).attr("width",xScale(item.val));
      svg.append("text").attr("x",mL+w+6).attr("y",y+rowH/2).attr("dominant-baseline","middle").attr("fill",item.color).attr("font-family","'Orbitron',sans-serif").attr("font-size",10).attr("font-weight",700).text(item.val.toFixed(1));
    });
  }, [data]);
  return <svg ref={ref} style={{ width:"100%", height:data.length*26+10, display:"block" }} />;
}

// ─── Action Button ────────────────────────────────────────────────────────────

function ActionButton({ label, icon, color, onClick }: { label: string; icon: string; color: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onClick={onClick} style={{
      background:hovered?"#0a1628":"#060d1a", border:`1px solid ${hovered?color:"#0d2a40"}`, color:hovered?color:"#4a8aaa",
      fontFamily:FONT,fontSize:10,letterSpacing:1,padding:"10px 12px",cursor:"pointer",textAlign:"left",width:"100%",
      transform:hovered?"translateX(3px)":"none",transition:"all .18s",display:"flex",alignItems:"center",gap:8,position:"relative",overflow:"hidden",
    }}>
      <span style={{ position:"absolute",left:0,top:0,bottom:0,width:2,background:color,opacity:hovered?1:0,transition:"opacity .18s" }} />
      <span style={{ width:22,height:22,borderRadius:3,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,background:hovered?`${color}28`:`${color}12`,border:`1px solid ${hovered?color:`${color}30`}`,transition:"all .18s" }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Drill Modal ──────────────────────────────────────────────────────────────

function DrillModal({ open, onClose, title, color, drill, onBack }: { open:boolean;onClose:()=>void;title:string;color:string;drill:DrillData;onBack:()=>void }) {
  useEffect(()=>{ const h=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();}; if(open)document.addEventListener("keydown",h); return()=>document.removeEventListener("keydown",h); },[open,onClose]);
  if (!open) return null;
  const isRankBar = drill.chartType==="rankbar";
  const numericData: number[] = isRankBar ? [] : (drill.chartData as number[]).map(Number).filter(isFinite);
  const rankData: RankItem[] = isRankBar ? (drill.chartData as RankItem[]) : [];
  return (
    <>
      <style>{`@keyframes modal-in{from{opacity:0;transform:translateX(18px) scale(.97)}to{opacity:1;transform:translateX(0) scale(1)}} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div onClick={e=>{if(e.currentTarget===e.target)onClose();}} style={{ position:"fixed",inset:0,zIndex:200,background:"rgba(4,10,22,.88)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }}>
        <div style={{ background:"linear-gradient(145deg,#0b1b33,#071222)",border:`1px solid ${color}66`,width:"min(680px, 96vw)",maxHeight:"88vh",overflowY:"auto",position:"relative",animation:"modal-in .32s cubic-bezier(.4,0,.2,1) both",boxShadow:`0 40px 120px rgba(0,0,0,.8),0 0 60px ${color}12`,fontFamily:FONT }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:"1px solid #0a2540",position:"sticky",top:0,background:"#0b1b33",zIndex:5 }}>
            <button onClick={onBack} style={{ background:"none",border:"1px solid #0d2a40",color:"#4a8aaa",cursor:"pointer",fontSize:16,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT,flexShrink:0,marginRight:12 }}>←</button>
            <span style={{ fontFamily:"'Orbitron',sans-serif",fontSize:12,fontWeight:700,letterSpacing:2,color,flex:1 }}>{title}</span>
            <button onClick={onClose} style={{ background:"none",border:"1px solid #0d2a40",color:"#4a8aaa",cursor:"pointer",fontSize:16,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT }}>✕</button>
          </div>
          <div style={{ padding:20 }}>
            <div style={{ display:"grid",gridTemplateColumns:`repeat(${Math.min(drill.stats.length,4)},1fr)`,gap:10,marginBottom:20 }}>
              {drill.stats.map((s,idx)=>(
                <div key={s.label} style={{ background:"#080f1c",border:"1px solid #0a1e30",borderTop:`2px solid ${s.color}`,padding:"10px 12px",animation:`fadeUp .35s ease ${idx*0.05}s both` }}>
                  <div style={{ fontSize:8,letterSpacing:1.5,color:"#4a8aaa",marginBottom:6 }}>{s.label}</div>
                  <div style={{ fontFamily:"'Orbitron',sans-serif",fontSize:18,fontWeight:700,color:s.color }}>{s.val}</div>
                </div>
              ))}
            </div>
            <div style={{ background:"#060d1a",border:"1px solid #0a1e30",padding:16,marginBottom:20 }}>
              <div style={{ fontSize:9,letterSpacing:2,color:"#4a9aba",marginBottom:12 }}>{drill.title}</div>
              {drill.chartType==="line"    && <D3LineChart  labels={drill.chartLabels} data={numericData} color={color} data2={drill.chartData2} />}
              {drill.chartType==="bar"     && <D3BarChart   labels={drill.chartLabels} data={numericData} color={color} />}
              {drill.chartType==="radar"   && <D3RadarChart labels={drill.chartLabels} data={numericData} color={color} data2={drill.chartData2} />}
              {drill.chartType==="rankbar" && <D3RankBar data={rankData} />}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              {drill.actions.map((action)=>(
                <div key={action} style={{ background:"#080f1c",border:"1px solid #0a1e30",borderLeft:`2px solid ${color}`,padding:12 }}>
                  <div style={{ fontSize:10,color:"#5a9abb",lineHeight:1.5 }}>› {action}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Drill Panel ──────────────────────────────────────────────────────────────

const ALL_ACTION_BUTTONS = [
  { key:"compare",   label:"Compare vs Year", icon:"⇄", color:"#f5a623" },
  { key:"countries", label:"View by State",   icon:"◉", color:"#00d97e" },
  { key:"alerts",    label:"Score Alerts",    icon:"⚠", color:"#ef233c" },
];

function buildModalContent(key: string, kpiSlot: number, compareYear: number, alertThreshold: number, national: NationalStats | null) {
  const avg = n(national?.avg_score ?? 65);
  switch (key) {
    case "compare": {
      const delta = (2024 - compareYear) * 0.5;
      const base2024 = [72,61,59,65];
      const baseOld = base2024.map(v => Math.max(20, +(v - delta*(0.8+Math.random()*0.4)).toFixed(1)));
      const scoreDelta = +(delta*0.6).toFixed(1);
      return { color:"#f5a623", title:`⇄  COMPARISON — ${compareYear} VS 2024`,
        drill: { title:`PILLARS — ${compareYear} VS 2024`, chartType:"radar" as ChartType, chartLabels:["CPI","Accessibility","Transport","Economy"],
          chartData: base2024, chartData2:{ label:String(compareYear), values:baseOld, color:"#f5a623" },
          stats:[{label:"2024 SCORE",val:String(avg),color:"#00d97e"},{label:`${compareYear} SCORE`,val:String(+(avg-delta*0.6).toFixed(1)),color:"#f5a623"},{label:"DELTA",val:`+${scoreDelta}`,color:"#00d4ff"},{label:"TREND",val:scoreDelta>0?"↑":"↓",color:"#b44dff"}],
          actions:[`CPI +${(delta*0.84).toFixed(1)} pts`,`Transport +${(delta*0.62).toFixed(1)} pts`,"Accessibility −1.3 pts (rural)","Full comparative report"],
        } };
    }
    case "countries":
      return { color:"#00d97e", title:"◉  VIEW BY STATE",
        drill:{ title:"RANKING BY COMPOSITE SCORE", chartType:"rankbar" as ChartType, chartLabels:[], chartData:[] as RankItem[],
          stats:[{label:"≥ 70",val:"see ranking",color:"#00d97e"},{label:"55–69",val:"moderate",color:"#f5a623"},{label:"< 55",val:"critical",color:"#ef233c"},{label:"SOURCE",val:"PostgreSQL",color:"#00d4ff"}],
          actions:["Filter by region","Export ranking","View state detail","Set alert threshold"],
        } };
    case "alerts":
      return { color:"#ef233c", title:`⚠  ALERTS — SCORE < ${alertThreshold}`,
        drill:{ title:"ALERT TREND (12 MONTHS)", chartType:"line" as ChartType, chartLabels:HIST_LABELS,
          chartData: kpiSlot===3?[3,2,4,5,3,2,2,3,2,2,2,2]:[6,5,7,8,6,5,4,5,4,5,4,4],
          chartData2:{ label:"Monitoring", values:kpiSlot===3?[5,6,4,5,6,5,4,4,4,4,3,3]:[9,10,8,9,10,9,8,7,8,7,7,7], color:"#f5a623" },
          stats:[{label:"ACTIVE ALERTS",val:kpiSlot===3?"2":"4",color:"#ef233c"},{label:"MONITORING",val:kpiSlot===3?"3":"7",color:"#f5a623"},{label:"RESOLVED (30d)",val:"2",color:"#00d97e"},{label:"THRESHOLD",val:String(alertThreshold),color:"#00d4ff"}],
          actions:["View critical state list","Export alert report","Set notification rules","Acknowledge alerts"],
        } };
    default: return { color:"#00d4ff", title:"INFO", drill:{title:"",chartType:"bar" as ChartType,chartLabels:[],chartData:[],stats:[],actions:[]} };
  }
}

function DrillPanel({ drill, color, open, onClose, onAction, hiddenActions=[], alertLabel="" }: { drill:DrillData;color:string;open:boolean;onClose:()=>void;onAction:(k:string)=>void;hiddenActions?:string[];alertLabel?:string }) {
  const visibleButtons = ALL_ACTION_BUTTONS.filter(b=>!hiddenActions.includes(b.key)).map(b=>b.key==="alerts"?{...b,label:alertLabel}:b);
  const safePanelData = (drill.chartData as number[]).map(Number).filter(isFinite);
  return (
    <div style={{ background:"#060d1a",border:`1px solid ${open?"#00b4d8":"#0d3a5c"}`,borderTop:"none",overflow:"hidden",maxHeight:open?400:0,opacity:open?1:0,transition:"max-height .45s cubic-bezier(.4,0,.2,1), opacity .35s, border-color .25s",fontFamily:FONT }}>
      <div style={{ padding:16,display:"flex",gap:16 }}>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:9,letterSpacing:2,color:"#4a9aba",borderBottom:"1px solid #0a1e30",paddingBottom:8,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span>OVERALL SCORE — HISTORY</span>
            <button onClick={onClose} style={{ background:"none",border:"none",color:"#4a8aaa",cursor:"pointer",fontFamily:FONT,fontSize:13,lineHeight:"1",padding:"0 2px" }}>✕</button>
          </div>
          {open && <D3LineChart labels={drill.chartLabels} data={safePanelData} color={color} />}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:10 }}>
            {drill.stats.map(s=>(
              <div key={s.label} style={{ background:"#080f1c",border:"1px solid #0a1e30",borderTop:`2px solid ${s.color}`,padding:"7px 9px" }}>
                <div style={{ fontSize:9,letterSpacing:1,color:"#4a8aaa",marginBottom:3 }}>{s.label}</div>
                <div style={{ fontFamily:"'Orbitron',sans-serif",fontSize:13,fontWeight:700,color:s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ width:200,flexShrink:0 }}>
          <div style={{ fontSize:9,letterSpacing:2,color:"#4a9aba",borderBottom:"1px solid #0a1e30",paddingBottom:8,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <span>QUICK ACTIONS</span>
            <button onClick={onClose} style={{ background:"none",border:"1px solid #0d2a40",color:"#4a8aaa",cursor:"pointer",fontFamily:FONT,fontSize:14,width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center" }}>←</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {visibleButtons.map(btn=>(
              <ActionButton key={btn.key} label={btn.label} icon={btn.icon} color={btn.color} onClick={()=>onAction(btn.key)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 3D Card ──────────────────────────────────────────────────────────────────

function Card3D({ card, active, onToggle }: { card:MetricCardProps;active:boolean;onToggle:()=>void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [glowIntense, setGlowIntense] = useState(false);
  const b = BADGE[card.badgeVariant];
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect(), x=(e.clientX-r.left)/r.width-0.5, y=(e.clientY-r.top)/r.height-0.5;
    el.style.transition="border-color .25s, box-shadow .25s";
    el.style.transform=`rotateX(${y*-14}deg) rotateY(${x*14}deg) translate(${x*4}px,${y*4}px) translateZ(10px)`;
  },[]);
  const onMouseLeave = useCallback(()=>{
    const el=cardRef.current; if(!el) return;
    el.style.transition="transform .5s cubic-bezier(.4,0,.2,1), border-color .25s, box-shadow .25s";
    el.style.transform="rotateX(0deg) rotateY(0deg) translate(0,0) translateZ(0)";
    setGlowIntense(false);
  },[]);
  const onMouseEnter = useCallback(()=>setGlowIntense(true),[]);
  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700&display=swap'); @keyframes kpi-shimmer{0%{left:-60%}100%{left:160%}} @keyframes kpi-pulse-core{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}} @keyframes kpi-pulse-ring{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:0;transform:scale(2.2)}}`}</style>
      <div style={{ perspective:900 }}>
        <div ref={cardRef} onClick={onToggle} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} onMouseEnter={onMouseEnter}
          style={{ background:"linear-gradient(145deg,#0d1f3a 0%,#091628 60%,#0a1e35 100%)",border:`${active?"1.5px":"1px"} solid ${active?card.color:"#0d3a5c"}`,position:"relative",overflow:"hidden",cursor:"pointer",transformStyle:"preserve-3d",transform:"rotateX(0deg) rotateY(0deg) translateZ(0)",willChange:"transform",
            boxShadow:active?`0 20px 60px rgba(0,0,0,.6),0 0 30px ${card.color}22`:glowIntense?`0 12px 40px rgba(0,0,0,.5),0 0 20px ${card.color}14`:"none",
            transition:"border-color .25s, box-shadow .25s",fontFamily:FONT }}>
          <div style={{ position:"absolute",top:0,left:"-60%",width:"40%",height:"100%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)",animation:"kpi-shimmer 5s ease-in-out infinite",pointerEvents:"none",zIndex:2 }} />
          <div style={{ position:"absolute",inset:0,background:"linear-gradient(135deg,rgba(255,255,255,.045) 0%,transparent 50%,rgba(0,0,0,.12) 100%)",pointerEvents:"none",zIndex:1 }} />
          <div style={{ position:"absolute",inset:0,background:`linear-gradient(160deg,${card.color}12 0%,transparent 40%)`,pointerEvents:"none",zIndex:3,opacity:glowIntense?1:0,transition:"opacity .3s" }} />
          <div style={{ height:3,width:"100%",background:card.color,position:"relative",zIndex:5 }}>
            <div style={{ position:"absolute",inset:0,background:card.color,filter:"blur(4px)",opacity:0.55,zIndex:-1 }} />
          </div>
          <div style={{ position:"absolute",top:8,left:8,width:18,height:18,borderTop:"1px solid rgba(255,255,255,.12)",borderLeft:"1px solid rgba(255,255,255,.12)",zIndex:4 }} />
          <div style={{ position:"absolute",bottom:8,right:8,width:18,height:18,borderBottom:"1px solid rgba(255,255,255,.06)",borderRight:"1px solid rgba(255,255,255,.06)",zIndex:4 }} />
          {card.pulse && (
            <div style={{ position:"absolute",top:12,right:12,width:8,height:8,zIndex:10 }}>
              <div style={{ position:"absolute",inset:0,borderRadius:"50%",background:card.color,animation:"kpi-pulse-core 2s ease-in-out infinite" }} />
              <div style={{ position:"absolute",top:-4,left:-4,width:16,height:16,borderRadius:"50%",border:`1.5px solid ${card.color}`,opacity:0.4,animation:"kpi-pulse-ring 2s ease-in-out infinite" }} />
            </div>
          )}
          <div style={{ padding:"14px 14px 8px",position:"relative",zIndex:5 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11 }}>
              <span style={{ fontSize:9,letterSpacing:2,color:"#4a8aaa",fontWeight:600 }}>{card.label}</span>
              <span style={{ fontSize:9,letterSpacing:1,padding:"2px 7px",borderRadius:2,background:b.bg,color:b.c,border:`1px solid ${b.b}` }}>{b.i} {card.badge}</span>
            </div>
            <div style={{ display:"flex",alignItems:"flex-end",gap:8,marginBottom:5 }}>
              <span style={{ fontFamily:"'Orbitron',sans-serif",fontSize:28,fontWeight:700,lineHeight:1,color:card.color,textShadow:glowIntense?`0 0 30px ${card.color},0 0 60px ${card.color}88`:`0 0 20px ${card.color}88`,transition:"text-shadow .3s" }}>{card.val}</span>
              {card.unit && <span style={{ fontSize:11,color:"#3a6e8a",marginBottom:4 }}>{card.unit}</span>}
            </div>
            <div style={{ fontSize:10,color:"#4a8aaa",marginBottom:10 }}>{card.sub}</div>
            {card.pct != null && (
              <div style={{ height:3,background:"#0c1e30",marginBottom:10,position:"relative",overflow:"visible" }}>
                <div style={{ height:"100%",width:`${card.pct}%`,background:card.color,position:"relative",transition:"width 1s cubic-bezier(.4,0,.2,1)" }}>
                  <div style={{ position:"absolute",right:0,top:-3,width:7,height:9,background:card.color,clipPath:"polygon(50% 0%,100% 100%,0% 100%)",filter:"brightness(1.6)" }} />
                </div>
              </div>
            )}
            <Sparkline values={card.spark} color={card.color} />
          </div>
          <div style={{ fontSize:9,letterSpacing:1,color:"#2a5a7a",borderTop:"1px solid #0a1e30",padding:"5px 14px",whiteSpace:"nowrap",overflow:"hidden",position:"relative",zIndex:5 }}>{card.ticker}</div>
          <div style={{ position:"absolute",bottom:0,left:0,right:0,height:4,background:"rgba(0,0,0,.4)" }} />
        </div>
      </div>
    </>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard(props: MetricCardProps & { national?: NationalStats | null }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeModalKey, setActiveModalKey] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(2022);
  const kpiSlot = props.kpiSlot ?? 1;
  const alertThreshold = kpiSlot === 3 ? 20 : 60;
  const alertLabel = `Score Alerts < ${alertThreshold}`;
  const handleAction = (key: string) => {
    if (key === "compare") { setSelectedYear(2022); setActiveModalKey("compare"); }
    else setActiveModalKey(key);
  };
  const modalContent = activeModalKey ? buildModalContent(activeModalKey, kpiSlot, selectedYear, alertThreshold, props.national ?? null) : null;
  return (
    <div>
      <Card3D card={props} active={panelOpen} onToggle={()=>setPanelOpen(p=>!p)} />
      {props.drill && (
        <DrillPanel drill={props.drill} color={props.color} open={panelOpen} onClose={()=>setPanelOpen(false)}
          onAction={handleAction} hiddenActions={props.hiddenActions} alertLabel={alertLabel} />
      )}
      {modalContent && (
        <DrillModal open={activeModalKey !== null} onClose={()=>{setActiveModalKey(null);setPanelOpen(false);}}
          onBack={()=>{setActiveModalKey(null);setPanelOpen(true);}}
          title={modalContent.title} color={modalContent.color} drill={modalContent.drill} />
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ background:"linear-gradient(145deg,#0d1f3a,#091628)",border:"1px solid #0d3a5c",padding:20,fontFamily:FONT }}>
      <div style={{ height:3,background:"#0d3a5c",marginBottom:16 }} />
      {[60,40,80].map((w,i)=>(
        <div key={i} style={{ height:i===1?32:10,width:`${w}%`,background:"#0a1e30",marginBottom:12,borderRadius:2 }} />
      ))}
    </div>
  );
}

// ─── KpiGrid (main export) ────────────────────────────────────────────────────

export function KpiGrid() {
  const { states, national, loading, error, refetch } = useDashboardData();

  if (loading) {
    return (
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))",gap:16 }}>
        {[1,2,3,4].map(i=><SkeletonCard key={i} />)}
      </div>
    );
  }

  if (error || !national) {
    return (
      <div style={{ border:"1px solid #ef233c44",background:"#ef233c0a",color:"#ef233c",fontFamily:FONT,fontSize:10,letterSpacing:1,padding:"12px 16px",display:"flex",alignItems:"center",gap:10 }}>
        <span style={{ fontSize:14 }}>⚠</span>
        <span>
          BACKEND UNAVAILABLE — {error || "No data returned"}
          <br />
          <span style={{ color:"#4a8aaa",marginTop:4,display:"block" }}>Vérifiez que Express tourne sur {process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}</span>
          <button onClick={refetch} style={{ marginTop:6,background:"none",border:"1px solid #ef233c44",color:"#ef233c",fontFamily:FONT,fontSize:9,letterSpacing:1,padding:"4px 8px",cursor:"pointer" }}>RETRY</button>
        </span>
      </div>
    );
  }

  const cards = buildCards(states, national);

  return (
    <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))",gap:16 }}>
      {cards.map((card, i) => (
        <MetricCard key={i} {...card} national={national} />
      ))}
    </div>
  );
}

export default KpiGrid;







