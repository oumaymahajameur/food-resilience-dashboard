"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";

// ─── Static population data ───────────────────────────────────────────────────
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

// ─── Types ────────────────────────────────────────────────────────────────────
interface StateData {
  state_id?: number;
  state_code: string;
  state_name: string;
  region: string;
  division?: string;
  population_2020?: number;
  area_sq_miles?: number;
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

interface ShockConfig {
  cpiIncrease: number;
  snapCut: number;
  transitCut: number;
  incomeShock: number;
}

interface SimResult extends StateData {
  newScore: number;
  delta: number;
  critical: boolean;
  factorDeltas: { xpi: number; access: number; transit: number; income: number };
}

interface PredictionScore {
  id: number;
  state_name: string;
  prediction_year: number;
  predicted_score: number;
  previous_score: number;
  change_percentage: number;
  risk_level: "Critical" | "High" | "Medium" | "Low";
  created_at: string;
}

interface PredictionSummary {
  state_name: string;
  state_code: string;
  scores: { year: number; score: number; change_pct: number; risk: string }[];
  trend: "up" | "down" | "stable";
  worst_year: number;
  worst_score: number;
}

// ─── API ──────────────────────────────────────────────────────────────────────
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ─── FIPS ─────────────────────────────────────────────────────────────────────
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

const NAME_TO_CODE: Record<string, string> = {
  "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA",
  "Colorado":"CO","Connecticut":"CT","Delaware":"DE","Florida":"FL","Georgia":"GA",
  "Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS",
  "Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA",
  "Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT",
  "Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM",
  "New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK",
  "Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC",
  "South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT",
  "Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPopulation(stateName: string, apiPop?: number): number {
  return STATE_POPULATION[stateName] ?? apiPop ?? 0;
}

function applyShock(state: StateData, shock: ShockConfig): SimResult {
  const xpiDelta     = -(shock.cpiIncrease * 0.35);
  const accessDelta  = -(shock.snapCut     * 0.28);
  const transitDelta = -(shock.transitCut  * 0.20);
  const incomeDelta  = -(shock.incomeShock * 0.17);
  const newXpi     = Math.max(0, Math.min(100, Number(state.xpi_score)     + xpiDelta));
  const newAccess  = Math.max(0, Math.min(100, Number(state.access_score)  + accessDelta));
  const newTransit = Math.max(0, Math.min(100, Number(state.transit_score) + transitDelta));
  const newIncome  = Math.max(0, Math.min(100, Number(state.income_score)  + incomeDelta));
  const newScore = Math.round(newXpi * 0.35 + newAccess * 0.28 + newTransit * 0.20 + newIncome * 0.17);
  const delta    = newScore - Math.round(Number(state.composite_score));
  return {
    ...state, newScore, delta,
    critical: newScore < 50,
    factorDeltas: {
      xpi:     Math.round(xpiDelta),
      access:  Math.round(accessDelta),
      transit: Math.round(transitDelta),
      income:  Math.round(incomeDelta),
    },
  };
}

function getScoreColor(score: number): string {
  if (score >= 75) return "#00ffa3";
  if (score >= 60) return "#00d4ff";
  if (score >= 45) return "#ff9500";
  return "#ff2d55";
}
function getRiskLabel(score: number): string {
  if (score >= 75) return "LOW RISK";
  if (score >= 60) return "MEDIUM";
  if (score >= 45) return "HIGH RISK";
  return "CRITICAL";
}
function getRiskColor(risk: string): string {
  if (risk === "Low")    return "#00ffa3";
  if (risk === "Medium") return "#00d4ff";
  if (risk === "High")   return "#ff9500";
  return "#ff2d55";
}

function buildPredictionSummaries(rows: PredictionScore[]): PredictionSummary[] {
  const map: Record<string, PredictionSummary> = {};
  for (const row of rows) {
    const code = NAME_TO_CODE[row.state_name] ?? "??";
    if (!map[row.state_name]) {
      map[row.state_name] = { state_name: row.state_name, state_code: code, scores: [], trend: "stable", worst_year: row.prediction_year, worst_score: row.predicted_score };
    }
    map[row.state_name].scores.push({ year: row.prediction_year, score: Number(row.predicted_score), change_pct: Number(row.change_percentage), risk: row.risk_level });
  }
  return Object.values(map).map(s => {
    s.scores.sort((a, b) => a.year - b.year);
    const first = s.scores[0]?.score ?? 0;
    const last  = s.scores[s.scores.length - 1]?.score ?? 0;
    s.trend = last > first + 1 ? "up" : last < first - 1 ? "down" : "stable";
    const worst = s.scores.reduce((a, b) => a.score < b.score ? a : b);
    s.worst_year  = worst.year;
    s.worst_score = worst.score;
    return s;
  });
}

// ─── D3 USA Choropleth Map ────────────────────────────────────────────────────
function USMap3D({ results, hasRun, onHover, onSelect, selectedCode }: {
  results: SimResult[]; hasRun: boolean;
  onHover: (s: SimResult | null, x?: number, y?: number) => void;
  onSelect: (s: SimResult) => void; selectedCode: string | null;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [geo, setGeo] = useState<any>(null);

  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
      .then(r => r.json()).then(us => setGeo(feature(us as any, (us as any).objects.states)));
  }, []);

  useEffect(() => {
    if (!ref.current || !geo || !results.length) return;
    const W = ref.current.clientWidth || 740, H = ref.current.clientHeight || 370;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const proj = d3.geoAlbersUsa().fitSize([W - 30, H - 30], geo);
    const path = d3.geoPath().projection(proj);
    const byCode: Record<string, SimResult> = {};
    results.forEach(r => { byCode[r.state_code] = r; });
    const defs = svg.append("defs");
    const glow = defs.append("filter").attr("id","wif_glow");
    glow.append("feGaussianBlur").attr("stdDeviation","5").attr("result","blur");
    const m1 = glow.append("feMerge"); m1.append("feMergeNode").attr("in","blur"); m1.append("feMergeNode").attr("in","SourceGraphic");
    const pulse = defs.append("filter").attr("id","wif_pulse");
    pulse.append("feGaussianBlur").attr("stdDeviation","3").attr("result","blur");
    const m2 = pulse.append("feMerge"); m2.append("feMergeNode").attr("in","blur"); m2.append("feMergeNode").attr("in","SourceGraphic");
    (geo as any).features.forEach((feat: any, idx: number) => {
      const name = FIPS_TO_NAME[feat.id?.toString().padStart(2,"0")];
      const code = name ? NAME_TO_CODE[name] : null;
      const r = code ? byCode[code] : null;
      if (!r) return;
      const score = hasRun ? r.newScore : Math.round(Number(r.composite_score));
      const color = getScoreColor(score);
      const g = defs.append("radialGradient").attr("id",`wif_g${idx}`).attr("cx","38%").attr("cy","32%").attr("r","68%");
      g.append("stop").attr("offset","0%").attr("stop-color",color).attr("stop-opacity","1");
      g.append("stop").attr("offset","100%").attr("stop-color",color).attr("stop-opacity","0.4");
    });
    const bv = defs.append("linearGradient").attr("id","wif_bevel").attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",1);
    bv.append("stop").attr("offset","0%").attr("stop-color","white").attr("stop-opacity","0.18");
    bv.append("stop").attr("offset","45%").attr("stop-color","white").attr("stop-opacity","0");
    const mapG = svg.append("g").attr("transform","translate(15,10)");
    mapG.selectAll(".dp").data((geo as any).features).join("path").attr("class","dp").attr("d",path as any).attr("transform","translate(4,8)").attr("fill","rgba(0,0,0,0.5)").attr("stroke","none");
    [5,3,1].forEach((off,oi) => {
      mapG.selectAll(`.sl${oi}`).data((geo as any).features).join("path").attr("class",`sl${oi}`).attr("d",path as any).attr("transform",`translate(${off*0.5},${off})`)
        .attr("fill",(d:any) => { const name = FIPS_TO_NAME[(d as any).id?.toString().padStart(2,"0")]; const code = name ? NAME_TO_CODE[name] : null; const r = code ? byCode[code] : null; if (!r) return "#040e1e"; const score = hasRun ? r.newScore : Math.round(Number(r.composite_score)); return getScoreColor(score) + "20"; })
        .attr("stroke","#010810").attr("stroke-width","0.3");
    });
    const stateG = mapG.selectAll(".sg").data((geo as any).features).join("g").attr("class","sg");
    stateG.append("path").attr("d",path as any)
      .attr("fill",(d:any,i:number) => { const name = FIPS_TO_NAME[(d as any).id?.toString().padStart(2,"0")]; const code = name ? NAME_TO_CODE[name] : null; if (!code) return "#0a1628"; return `url(#wif_g${i})`; })
      .attr("stroke",(d:any) => { const name = FIPS_TO_NAME[(d as any).id?.toString().padStart(2,"0")]; return NAME_TO_CODE[name] === selectedCode ? "#ffffff" : "rgba(1,8,16,0.85)"; })
      .attr("stroke-width",(d:any) => { const name = FIPS_TO_NAME[(d as any).id?.toString().padStart(2,"0")]; return NAME_TO_CODE[name] === selectedCode ? 2.5 : 0.8; })
      .attr("filter",(d:any) => { const name = FIPS_TO_NAME[(d as any).id?.toString().padStart(2,"0")]; const code = NAME_TO_CODE[name]; if (code === selectedCode) return "url(#wif_glow)"; const r = code ? byCode[code] : null; if (hasRun && r?.critical) return "url(#wif_pulse)"; return "none"; })
      .style("cursor","pointer")
      .on("mouseover",function(event:any,d:any){ const name = FIPS_TO_NAME[(d as any).id?.toString().padStart(2,"0")]; const code = name ? NAME_TO_CODE[name] : null; const r = code ? byCode[code] : null; if (!r) return; d3.select(this).attr("stroke","rgba(255,255,255,0.6)").attr("stroke-width","1.5"); const [mx,my] = d3.pointer(event,ref.current); onHover(r,mx,my); })
      .on("mousemove",function(event:any,d:any){ const name = FIPS_TO_NAME[(d as any).id?.toString().padStart(2,"0")]; const code = name ? NAME_TO_CODE[name] : null; const r = code ? byCode[code] : null; if (!r) return; const [mx,my] = d3.pointer(event,ref.current); onHover(r,mx,my); })
      .on("mouseout",function(_:any,d:any){ const name = FIPS_TO_NAME[(d as any).id?.toString().padStart(2,"0")]; const code = NAME_TO_CODE[name]; d3.select(this).attr("stroke", code === selectedCode ? "#ffffff" : "rgba(1,8,16,0.85)").attr("stroke-width", code === selectedCode ? 2.5 : 0.8); onHover(null); })
      .on("click",(_:any,d:any)=>{ const name = FIPS_TO_NAME[(d as any).id?.toString().padStart(2,"0")]; const code = NAME_TO_CODE[name]; const r = code ? byCode[code] : null; if (r) onSelect(r); });
    stateG.append("path").attr("d",path as any).attr("fill","url(#wif_bevel)").attr("pointer-events","none");
    (geo as any).features.forEach((feat:any) => {
      const name = FIPS_TO_NAME[feat.id?.toString().padStart(2,"0")];
      const code = name ? NAME_TO_CODE[name] : null;
      const r = code ? byCode[code] : null;
      if (!r) return;
      const c = path.centroid(feat);
      if (!c || isNaN(c[0])) return;
      const score = hasRun ? r.newScore : Math.round(Number(r.composite_score));
      const color = getScoreColor(score);
      const isSel = code === selectedCode;
      mapG.append("circle").attr("cx",c[0]).attr("cy",c[1]).attr("r",isSel?10:hasRun&&r.critical?6.5:4).attr("fill","none").attr("stroke",color).attr("stroke-width",isSel?1.8:0.9).attr("opacity",0.45).attr("pointer-events","none");
      mapG.append("circle").attr("cx",c[0]).attr("cy",c[1]).attr("r",isSel?5:2.5).attr("fill",color).attr("opacity",0.92).attr("pointer-events","none").attr("filter",isSel?"url(#wif_glow)":"none");
      if (isSel) { mapG.append("text").attr("x",c[0]).attr("y",c[1]-15).attr("text-anchor","middle").attr("fill",color).attr("font-size","12").attr("font-weight","900").attr("font-family","'JetBrains Mono',monospace").attr("pointer-events","none").text(score); }
    });
    const gridG = svg.append("g").attr("opacity","0.025");
    for (let i=0; i<W; i+=28) gridG.append("line").attr("x1",i).attr("y1",0).attr("x2",i).attr("y2",H).attr("stroke","#00d4ff").attr("stroke-width","0.5");
    for (let j=0; j<H; j+=28) gridG.append("line").attr("x1",0).attr("y1",j).attr("x2",W).attr("y2",j).attr("stroke","#00d4ff").attr("stroke-width","0.5");
  }, [geo, results, hasRun, selectedCode]);

  return <svg ref={ref} style={{width:"100%",height:"100%"}} />;
}

// ─── Mini sparkline ───────────────────────────────────────────────────────────
function PredictionSparkline({ scores, color }: { scores: {year:number;score:number}[]; color: string }) {
  if (scores.length < 2) return null;
  const W = 72, H = 28;
  const minS = Math.min(...scores.map(s => s.score));
  const maxS = Math.max(...scores.map(s => s.score));
  const range = maxS - minS || 1;
  const pts = scores.map((s, i) => { const x = (i / (scores.length - 1)) * W; const y = H - ((s.score - minS) / range) * H; return `${x},${y}`; });
  return (
    <svg width={W} height={H} style={{overflow:"visible"}}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      {scores.map((s, i) => { const x = (i / (scores.length - 1)) * W; const y = H - ((s.score - minS) / range) * H; return <circle key={i} cx={x} cy={y} r={2.5} fill={color}/>; })}
    </svg>
  );
}

// ─── Score Legend Component ───────────────────────────────────────────────────
function ScoreLegend() {
  const items = [
    { color: "#00ffa3", label: "≥ 75", sublabel: "LOW RISK" },
    { color: "#00d4ff", label: "60–74", sublabel: "MEDIUM" },
    { color: "#ff9500", label: "45–59", sublabel: "HIGH RISK" },
    { color: "#ff2d55", label: "< 45", sublabel: "CRITICAL" },
  ];
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
      {items.map(({ color, label, sublabel }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            width: 14, height: 14, borderRadius: 3,
            background: color,
            boxShadow: `0 0 8px ${color}99`,
            flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{label}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1.5, lineHeight: 1, marginTop: 1 }}>{sublabel}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Forecast View ─────────────────────────────────────────────────────────────
function ForecastView({ summaries, loading, selectedPredState, onSelect }: {
  summaries: PredictionSummary[]; loading: boolean;
  selectedPredState: PredictionSummary | null; onSelect: (s: PredictionSummary | null) => void;
}) {
  const YEARS = [2026, 2027, 2028];
  const [filterRisk, setFilterRisk] = useState<string>("all");
  const [sortPred, setSortPred]     = useState<"score"|"trend"|"name">("score");

  const filtered = summaries
    .filter(s => filterRisk === "all" || s.scores.some(sc => sc.risk.toLowerCase() === filterRisk))
    .sort((a, b) => {
      if (sortPred === "score") return a.worst_score - b.worst_score;
      if (sortPred === "trend") { const order = {down: 0, stable: 1, up: 2}; return order[a.trend] - order[b.trend]; }
      return a.state_name.localeCompare(b.state_name);
    });

  const trendIcon  = (t: string) => t === "up" ? "↑" : t === "down" ? "↓" : "→";
  const trendColor = (t: string) => t === "up" ? "#00ffa3" : t === "down" ? "#ff2d55" : "#ff9500";

  if (loading) return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{width:36,height:36,border:"2px solid rgba(0,212,255,0.18)",borderTop:"2px solid #00d4ff",borderRadius:"50%",animation:"wif-spin 1s linear infinite"}}/>
      <span style={{fontSize:12,color:"rgba(0,212,255,0.55)",letterSpacing:3}}>LOADING PREDICTIONS...</span>
    </div>
  );

  if (!summaries.length) return (
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,color:"rgba(255,255,255,0.3)",fontSize:13,letterSpacing:2}}>
      <div style={{fontSize:44}}>🔮</div>NO PREDICTION DATA FOUND
    </div>
  );

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* KPI bar */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderBottom:"1px solid #0d2540",flexShrink:0}}>
        {[
          { label:"STATES FORECAST",  value: summaries.length,                                           color:"#00d4ff", icon:"◈" },
          { label:"DECLINING 2026–28", value: summaries.filter(s=>s.trend==="down").length,               color:"#ff2d55", icon:"↓" },
          { label:"WORST PROJECTED",  value: Math.min(...summaries.map(s=>s.worst_score)).toFixed(1),     color:"#ff2d55", icon:"⚠" },
          { label:"BEST PROJECTED",   value: Math.max(...summaries.map(s=>s.scores[0]?.score??0)).toFixed(1), color:"#00ffa3", icon:"↑" },
        ].map((k,i)=>(
          <div key={i} style={{padding:"12px 18px",borderRight:i<3?"1px solid #0d2540":"none",borderTop:`2px solid ${k.color}`,background:"rgba(3,11,24,0.7)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
              <span style={{fontSize:10,color:"#3a6a8a",letterSpacing:2.5}}>{k.label}</span>
              <span style={{fontSize:15,color:k.color}}>{k.icon}</span>
            </div>
            <div style={{fontSize:30,fontWeight:900,color:k.color,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{padding:"10px 16px",display:"flex",gap:10,alignItems:"center",borderBottom:"1px solid #0d2540",flexShrink:0,flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:"rgba(0,212,255,0.55)",letterSpacing:2.5,fontWeight:700}}>FILTER</span>
        {["all","critical","high","medium","low"].map(r=>(
          <button key={r} onClick={()=>setFilterRisk(r)} style={{
            background:filterRisk===r?"rgba(0,212,255,0.12)":"transparent",
            border:filterRisk===r?"1px solid rgba(0,212,255,0.4)":"1px solid rgba(255,255,255,0.09)",
            borderRadius:6,padding:"5px 13px",fontSize:10,letterSpacing:1.5,
            color:filterRisk===r?"#00d4ff":"rgba(255,255,255,0.45)",cursor:"pointer",
            fontFamily:"'Syne',sans-serif",textTransform:"uppercase",fontWeight:700,
          }}>{r}</button>
        ))}
        <div style={{flex:1}}/>
        <span style={{fontSize:10,color:"rgba(0,212,255,0.55)",letterSpacing:2.5,fontWeight:700}}>SORT</span>
        {(["score","trend","name"] as const).map(s=>(
          <button key={s} onClick={()=>setSortPred(s)} style={{
            background:sortPred===s?"rgba(0,212,255,0.12)":"transparent",
            border:sortPred===s?"1px solid rgba(0,212,255,0.4)":"1px solid rgba(255,255,255,0.09)",
            borderRadius:6,padding:"5px 13px",fontSize:10,letterSpacing:1.5,
            color:sortPred===s?"#00d4ff":"rgba(255,255,255,0.45)",cursor:"pointer",
            fontFamily:"'Syne',sans-serif",textTransform:"uppercase",fontWeight:700,
          }}>{s}</button>
        ))}
      </div>

      {/* Table header — NO SPARKLINE column */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"60px 1fr 70px 110px 110px 110px",
        padding:"8px 16px",fontSize:10,letterSpacing:2,color:"#4a7a9a",fontWeight:700,
        borderBottom:"1px solid #0d2540",position:"sticky",top:0,
        background:"rgba(3,11,24,0.98)",backdropFilter:"blur(8px)",flexShrink:0,
      }}>
        <span>CODE</span><span>STATE</span><span>TREND</span>
        {YEARS.map(y=><span key={y} style={{textAlign:"center"}}>{y}</span>)}
      </div>

      {/* Table rows — NO SPARKLINE */}
      <div style={{flex:1,overflowY:"auto"}}>
        {filtered.map(s => {
          const isSelected = selectedPredState?.state_name === s.state_name;
          const scoreByYear: Record<number, {score:number;risk:string;change_pct:number}> = {};
          s.scores.forEach(sc => { scoreByYear[sc.year] = sc; });
          const pop = getPopulation(s.state_name);
          return (
            <div
              key={s.state_code}
              className="wif-row"
              onClick={() => onSelect(isSelected ? null : s)}
              style={{
                display:"grid",
                gridTemplateColumns:"60px 1fr 70px 110px 110px 110px",
                padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,0.04)",
                alignItems:"center",cursor:"pointer",
                background: isSelected ? "rgba(0,212,255,0.07)" : s.trend==="down" ? "rgba(255,45,85,0.02)" : "transparent",
                border: isSelected ? "1px solid rgba(0,212,255,0.18)" : "1px solid transparent",
                borderRadius: isSelected ? 7 : 0,
                transition:"all 0.15s",
              }}
            >
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:700,color:trendColor(s.trend)}}>{s.state_code}</span>
              <div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.72)",fontWeight:600}}>{s.state_name}</div>
                {pop > 0 && <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",fontFamily:"'JetBrains Mono',monospace",marginTop:1}}>{(pop/1e6).toFixed(2)}M pop.</div>}
              </div>
              <span style={{fontSize:18,fontWeight:800,color:trendColor(s.trend),fontFamily:"'JetBrains Mono',monospace"}}>{trendIcon(s.trend)}</span>
              {YEARS.map(y => {
                const data = scoreByYear[y];
                if (!data) return <span key={y} style={{textAlign:"center",fontSize:12,color:"rgba(255,255,255,0.18)"}}>—</span>;
                const c = getRiskColor(data.risk);
                return (
                  <div key={y} style={{textAlign:"center"}}>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:15,fontWeight:800,color:c}}>{data.score.toFixed(1)}</div>
                    <div style={{fontSize:10,color:data.change_pct<0?"#ff2d55":"#00ffa3",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>
                      {data.change_pct>0?"+":""}{data.change_pct.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Prediction Detail Panel ──────────────────────────────────────────────────
function PredictionDetailPanel({ summary }: { summary: PredictionSummary }) {
  const pop = getPopulation(summary.state_name);
  return (
    <div className="wif-card" style={{padding:"16px",borderBottom:"1px solid #0d2540"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:"#e8f4ff"}}>{summary.state_name}</div>
          <div style={{fontSize:10,color:"#3a6a8a",letterSpacing:2,marginTop:2}}>
            {summary.state_code} · ML FORECAST 2026–2028
            {pop > 0 && ` · ${(pop/1e6).toFixed(2)}M pop.`}
          </div>
        </div>
        <div style={{
          fontSize:12,fontWeight:800,
          color: summary.trend==="up"?"#00ffa3":summary.trend==="down"?"#ff2d55":"#ff9500",
          fontFamily:"'JetBrains Mono',monospace",letterSpacing:1,
          background:summary.trend==="up"?"rgba(0,255,163,0.08)":summary.trend==="down"?"rgba(255,45,85,0.08)":"rgba(255,149,0,0.08)",
          border:`1px solid ${summary.trend==="up"?"rgba(0,255,163,0.25)":summary.trend==="down"?"rgba(255,45,85,0.25)":"rgba(255,149,0,0.25)"}`,
          borderRadius:6,padding:"4px 12px",
        }}>
          {summary.trend==="up"?"↑ IMPROVING":summary.trend==="down"?"↓ DECLINING":"→ STABLE"}
        </div>
      </div>
      {summary.scores.map(sc => {
        const c = getRiskColor(sc.risk);
        const barW = Math.max(0, Math.min(100, sc.score));
        return (
          <div key={sc.year} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,alignItems:"center"}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.5)",letterSpacing:2,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{sc.year}</span>
              <div style={{display:"flex",gap:9,alignItems:"center"}}>
                <span style={{fontSize:10,letterSpacing:1,color:c,background:`${c}10`,border:`1px solid ${c}30`,padding:"2px 8px",borderRadius:4}}>{sc.risk.toUpperCase()}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:15,fontWeight:800,color:c}}>{sc.score.toFixed(1)}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:sc.change_pct<0?"#ff2d55":"#00ffa3",fontWeight:700}}>
                  {sc.change_pct>0?"+":""}{sc.change_pct.toFixed(1)}%
                </span>
              </div>
            </div>
            <div style={{height:6,background:"rgba(255,255,255,0.05)",borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${barW}%`,background:`linear-gradient(90deg,${c}60,${c})`,borderRadius:3,transition:"width 0.6s ease"}}/>
            </div>
          </div>
        );
      })}
      <div style={{marginTop:12,padding:"9px 12px",background:"rgba(0,212,255,0.04)",borderRadius:7,border:"1px solid rgba(0,212,255,0.12)"}}>
        <div style={{fontSize:10,color:"#3a6a8a",letterSpacing:2,marginBottom:4}}>WORST PROJECTED YEAR</div>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:800,color:"#ff2d55"}}>
          {summary.worst_year} · {summary.worst_score.toFixed(1)} pts
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ScoreArc({ score, size=96 }: { score:number; size?:number }) {
  const color = getScoreColor(score);
  const r = size/2 - 8;
  const circ = 2*Math.PI*r;
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={circ*(1-score/100)} strokeLinecap="round"
          style={{filter:`drop-shadow(0 0 8px ${color})`,transition:"stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:size*0.24,fontWeight:800,color,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{score}</span>
        <span style={{fontSize:8,color:"rgba(255,255,255,0.35)",letterSpacing:1,marginTop:2}}>SCORE</span>
      </div>
    </div>
  );
}

function FactorBar({ label, value, delta, color }: { label:string;value:number;delta:number;color:string }) {
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:11,color:"rgba(255,255,255,0.5)",letterSpacing:1.5,fontWeight:600}}>{label}</span>
        <span style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color,fontWeight:700}}>
          {value} {delta!==0&&<span style={{color:delta>0?"#00ffa3":"#ff2d55"}}>({delta>0?"+":""}{delta})</span>}
        </span>
      </div>
      <div style={{height:5,background:"rgba(255,255,255,0.05)",borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${Math.max(0,Math.min(100,value))}%`,background:`linear-gradient(90deg,${color}99,${color})`,borderRadius:2,transition:"width 0.6s ease"}}/>
      </div>
    </div>
  );
}

function ShockSlider({ label, icon, value, onChange, color }: { label:string;icon:string;value:number;onChange:(v:number)=>void;color:string; }) {
  return (
    <div style={{marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:15}}>{icon}</span>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.6)",letterSpacing:1.5,textTransform:"uppercase",fontWeight:600}}>{label}</span>
        </div>
        <div style={{background:`${color}15`,border:`1px solid ${color}40`,borderRadius:5,padding:"3px 10px",fontFamily:"'JetBrains Mono',monospace",fontSize:12,color,fontWeight:700}}>+{value}%</div>
      </div>
      <div style={{position:"relative"}}>
        <div style={{height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
          <div style={{position:"absolute",height:"100%",width:`${value*2}%`,background:`linear-gradient(90deg,${color}50,${color})`,borderRadius:2}}/>
        </div>
        <input type="range" min={0} max={50} value={value} onChange={e=>onChange(Number(e.target.value))}
          style={{position:"absolute",top:"50%",left:0,transform:"translateY(-50%)",width:"100%",WebkitAppearance:"none",background:"transparent",cursor:"pointer",height:14,outline:"none",border:"none",margin:0} as any}/>
      </div>
    </div>
  );
}

function RegionalHeatStrip({ results, hasRun }: { results:SimResult[];hasRun:boolean }) {
  const regions = ["Northeast","Midwest","South","West"];
  return (
    <div style={{display:"flex",gap:6}}>
      {regions.map(region=>{
        const group = results.filter(r=>r.region===region);
        if (!group.length) return null;
        const avg = Math.round(group.reduce((a,r)=>a+(hasRun?r.newScore:Math.round(Number(r.composite_score))),0)/group.length);
        const color = getScoreColor(avg);
        return (
          <div key={region} style={{flex:1,padding:"8px 10px",borderRadius:7,background:`${color}0d`,border:`1px solid ${color}22`}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:1.5,marginBottom:3,fontWeight:700}}>{region.toUpperCase().slice(0,2)}</div>
            <div style={{fontSize:18,fontWeight:900,color,fontFamily:"'JetBrains Mono',monospace"}}>{avg}</div>
            <div style={{height:2,background:"rgba(255,255,255,0.05)",borderRadius:1,marginTop:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${avg}%`,background:color,borderRadius:1}}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ImpactBars({ results }: { results:SimResult[] }) {
  const worst = [...results].sort((a,b)=>a.delta-b.delta).slice(0,6);
  const maxAbs = Math.max(...worst.map(r=>Math.abs(r.delta)),1);
  return (
    <div>
      <div style={{fontSize:10,color:"rgba(0,212,255,0.6)",letterSpacing:3,marginBottom:12,fontWeight:700}}>DELTA IMPACT</div>
      {worst.map(r=>(
        <div key={r.state_code} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",color:"rgba(255,255,255,0.5)",width:24,fontWeight:700}}>{r.state_code}</span>
          <div style={{flex:1,height:5,background:"rgba(255,255,255,0.04)",borderRadius:2,overflow:"hidden",position:"relative"}}>
            <div style={{position:"absolute",right:"50%",top:0,width:`${(Math.abs(r.delta)/maxAbs)*50}%`,height:"100%",background:r.delta<0?"#ff2d55":"#00ffa3",borderRadius:"2px 0 0 2px"}}/>
          </div>
          <span style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:r.delta<0?"#ff2d55":"#00ffa3",width:30,textAlign:"right",fontWeight:700}}>
            {r.delta>0?"+":""}{r.delta}
          </span>
        </div>
      ))}
    </div>
  );
}

function PredictionMiniList({ summaries, onSelect }: { summaries: PredictionSummary[]; onSelect: (s: PredictionSummary) => void; }) {
  const worst = [...summaries].sort((a,b) => a.worst_score - b.worst_score).slice(0,5);
  return (
    <div>
      <div style={{fontSize:10,color:"rgba(255,45,85,0.7)",letterSpacing:3,marginBottom:11,fontWeight:700}}>⬇ WORST 2026–28 FORECAST</div>
      {worst.map((s, i) => {
        const tc = s.trend==="up"?"#00ffa3":s.trend==="down"?"#ff2d55":"#ff9500";
        const color = getRiskColor(s.scores.find(sc=>sc.year===s.worst_year)?.risk ?? "Critical");
        const pop = getPopulation(s.state_name);
        return (
          <div key={s.state_code} onClick={() => onSelect(s)} style={{
            display:"flex",alignItems:"center",gap:9,marginBottom:7,
            padding:"8px 10px",borderRadius:7,cursor:"pointer",
            background:"rgba(255,45,85,0.03)",border:"1px solid rgba(255,45,85,0.08)",transition:"all 0.15s",
          }}>
            <span style={{fontSize:10,color:"#1e3a52",fontFamily:"'JetBrains Mono',monospace",width:14,fontWeight:700}}>{i+1}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.65)",fontWeight:600}}>{s.state_name}</div>
              {pop > 0 && <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",fontFamily:"'JetBrains Mono',monospace"}}>{(pop/1e6).toFixed(1)}M</div>}
            </div>
            <PredictionSparkline scores={s.scores} color={tc}/>
            <div style={{textAlign:"right",minWidth:38}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:15,fontWeight:800,color}}>{s.worst_score.toFixed(0)}</div>
              <div style={{fontSize:9,color:tc,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{s.worst_year}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 3D Forecast NavBar Tab ──────────────────────────────────────────────────
function NavTab({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  const isForecast = label === "FORECAST";

  if (isForecast && active) {
    return (
      <button onClick={onClick} style={{
        flex: 1, padding: "10px 6px", borderRadius: 8, fontSize: 12,
        letterSpacing: 2, fontWeight: 800, cursor: "pointer",
        fontFamily: "'Syne',sans-serif", textTransform: "uppercase",
        position: "relative", overflow: "hidden",
        border: "1px solid rgba(0,212,255,0.6)",
        background: "linear-gradient(135deg, rgba(0,212,255,0.22), rgba(123,47,255,0.22), rgba(0,255,163,0.1))",
        color: "#00d4ff",
        boxShadow: "0 0 28px rgba(0,212,255,0.35), 0 4px 16px rgba(0,212,255,0.2), inset 0 1px 0 rgba(255,255,255,0.15)",
        transform: "perspective(120px) rotateX(-4deg) translateY(-1px)",
        transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 50%)", borderRadius: 8, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #00d4ff, #7b2fff, #00ffa3, transparent)", borderRadius: "0 0 8px 8px" }} />
        <span style={{ position: "relative", zIndex: 1, textShadow: "0 0 12px rgba(0,212,255,0.9), 0 0 24px rgba(0,212,255,0.4)" }}>{icon} {label}</span>
      </button>
    );
  }

  if (isForecast && !active) {
    return (
      <button onClick={onClick} style={{
        flex: 1, padding: "10px 6px", borderRadius: 8, fontSize: 12,
        letterSpacing: 2, fontWeight: 700, cursor: "pointer",
        fontFamily: "'Syne',sans-serif", textTransform: "uppercase",
        position: "relative", overflow: "hidden",
        border: "1px solid rgba(0,212,255,0.2)",
        background: "rgba(0,212,255,0.04)",
        color: "rgba(0,212,255,0.65)",
        transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}>
        <span>{icon} {label}</span>
      </button>
    );
  }

  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "10px 6px", borderRadius: 8, fontSize: 12,
      letterSpacing: 2, fontWeight: active ? 800 : 700,
      border: active ? "1px solid rgba(0,212,255,0.45)" : "1px solid rgba(255,255,255,0.09)",
      background: active ? "rgba(0,212,255,0.1)" : "transparent",
      color: active ? "#00d4ff" : "rgba(255,255,255,0.45)",
      cursor: "pointer", textTransform: "uppercase",
      fontFamily: "'Syne',sans-serif", transition: "all 0.2s",
    }}>
      {icon} {label}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WhatIfPage() {
  const [states, setStates]               = useState<StateData[]>([]);
  const [nationalStats, setNationalStats] = useState<NationalStats|null>(null);
  const [loading, setLoading]             = useState(true);
  const [apiError, setApiError]           = useState<string|null>(null);

  const [predictions, setPredictions]           = useState<PredictionScore[]>([]);
  const [predSummaries, setPredSummaries]       = useState<PredictionSummary[]>([]);
  const [predLoading, setPredLoading]           = useState(true);
  const [selectedPredState, setSelectedPredState] = useState<PredictionSummary|null>(null);

  const [shock, setShock]               = useState<ShockConfig>({cpiIncrease:0,snapCut:0,transitCut:0,incomeShock:0});
  const [results, setResults]           = useState<SimResult[]>([]);
  const [hoveredState, setHoveredState] = useState<SimResult|null>(null);
  const [tooltipPos, setTooltipPos]     = useState({x:0,y:0});
  const [selectedState, setSelectedState] = useState<SimResult|null>(null);
  const [isRunning, setIsRunning]       = useState(false);
  const [hasRun, setHasRun]             = useState(false);
  const [view, setView]                 = useState<"map"|"table"|"forecast">("map");
  const [sortBy, setSortBy]             = useState<"delta"|"score">("delta");

  useEffect(()=>{
    setLoading(true);
    Promise.all([apiFetch<StateData[]>("/api/etats"), apiFetch<NationalStats>("/api/stats/national")])
      .then(([s,st])=>{ setStates(s); setNationalStats(st); })
      .catch(err=>setApiError(err.message))
      .finally(()=>setLoading(false));
  },[]);

  useEffect(()=>{
    setPredLoading(true);
    apiFetch<PredictionScore[]>("/api/predictions")
      .then(rows => { setPredictions(rows); setPredSummaries(buildPredictionSummaries(rows)); })
      .catch(() => { setPredictions([]); setPredSummaries([]); })
      .finally(()=>setPredLoading(false));
  },[]);

  const runSimulation = useCallback(()=>{
    if (!states.length) return;
    setIsRunning(true);
    setTimeout(()=>{ setResults(states.map(s=>applyShock(s,shock))); setHasRun(true); setIsRunning(false); },900);
  },[shock,states]);

  useEffect(()=>{ if (!hasRun||!states.length) return; setResults(states.map(s=>applyShock(s,shock))); },[shock,hasRun,states]);

  const displayResults: SimResult[] = hasRun ? results : states.map(s=>({
    ...s, newScore:Math.round(Number(s.composite_score)), delta:0, critical:Number(s.composite_score)<50,
    factorDeltas:{xpi:0,access:0,transit:0,income:0},
  }));

  const criticalCount = results.filter(r=>r.critical).length;
  const avgDelta      = results.length ? Math.round(results.reduce((a,b)=>a+b.delta,0)/results.length) : 0;
  const avgNewScore   = results.length ? Math.round(results.reduce((a,b)=>a+b.newScore,0)/results.length)
    : nationalStats ? Math.round(Number(nationalStats.avg_score)) : null;
  const popAtRisk     = results.filter(r=>r.critical).reduce((a,b)=>a+(getPopulation(b.state_name, Number(b.population_2020))||0),0);
  const worstStates   = [...displayResults].sort((a,b)=>(hasRun?a.delta:a.newScore)-(hasRun?b.delta:b.newScore)).slice(0,5);
  const sortedResults = [...results].sort((a,b)=>sortBy==="delta"?a.delta-b.delta:a.newScore-b.newScore);

  const handleMapHover  = useCallback((s:SimResult|null,x?:number,y?:number)=>{ setHoveredState(s); if (x!==undefined&&y!==undefined) setTooltipPos({x,y}); },[]);
  const handleMapSelect = useCallback((s:SimResult)=>{ setSelectedState(prev=>prev?.state_code===s.state_code?null:s); },[]);

  const kpis = hasRun && avgNewScore !== null ? [
    {label:"AVG NEW SCORE",  value:avgNewScore,                         sub:`Δ ${avgDelta>0?"+":""}${avgDelta}`, color:getScoreColor(avgNewScore), icon:"◈"},
    {label:"CRITICAL STATES",value:criticalCount,                       sub:"Score below 50",                    color:"#ff2d55",                  icon:"⚠"},
    {label:"POP. AT RISK",   value:`${(popAtRisk/1e6).toFixed(1)}M`,    sub:"Critical states pop.",              color:"#ff9500",                  icon:"👥"},
    {label:"SCORE SPREAD",   value:nationalStats?Math.round(Number(nationalStats.dispersion)):"—", sub:"API dispersion", color:"#00d4ff",            icon:"↔"},
  ] : [];

  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", flex:1, minHeight:0, overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&family=Syne:wght@600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:rgba(0,212,255,0.22);border-radius:2px;}
        input[type=range]{-webkit-appearance:none;appearance:none;}
        input[type=range]::-webkit-slider-thumb{
          -webkit-appearance:none;width:15px;height:15px;border-radius:50%;
          background:#fff;cursor:pointer;
          box-shadow:0 0 10px rgba(0,212,255,0.85),0 2px 4px rgba(0,0,0,0.5);
        }
        @keyframes wif-fadeup{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes wif-spin{to{transform:rotate(360deg)}}
        @keyframes wif-pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes wif-scan{0%{transform:translateY(-100%)}100%{transform:translateY(100%)}}
        @keyframes wif-shimmer{0%,100%{opacity:0.7}50%{opacity:1}}
        .wif-card{animation:wif-fadeup 0.4s ease both;}
        .wif-row:hover{background:rgba(0,212,255,0.06)!important;}
        .wif-preset:hover{background:rgba(0,212,255,0.09)!important;border-color:rgba(0,212,255,0.3)!important;color:#00d4ff!important;}
      `}</style>

      {/* Background */}
      <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none"}}>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 12% 18%,rgba(0,45,100,0.38) 0%,transparent 52%),radial-gradient(ellipse at 88% 82%,rgba(70,0,110,0.22) 0%,transparent 50%),#030b18"}}/>
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(0,212,255,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.035) 1px,transparent 1px)",backgroundSize:"34px 34px"}}/>
        <div style={{position:"absolute",left:"10%",top:"20%",width:260,height:260,borderRadius:"50%",background:"rgba(0,200,255,0.055)",filter:"blur(38px)"}}/>
        <div style={{position:"absolute",right:"8%",bottom:"15%",width:220,height:220,borderRadius:"50%",background:"rgba(110,0,200,0.07)",filter:"blur(42px)"}}/>
        <div style={{position:"absolute",left:0,right:0,height:2,background:"linear-gradient(transparent,rgba(0,212,255,0.05),transparent)",animation:"wif-scan 14s linear infinite"}}/>
      </div>

      <div style={{ position:"relative", zIndex:1, fontFamily:"'Syne',sans-serif", display:"flex", flexDirection:"column", flex:1, minHeight:0, color:"white" }}>

        {/* KPI ROW */}
        {hasRun && kpis.length>0 && (
          <div className="wif-card" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderBottom:"1px solid #0d2540",flexShrink:0}}>
            {kpis.map((k,i)=>(
              <div key={i} style={{padding:"13px 22px",borderRight:i<3?"1px solid #0d2540":"none",borderTop:`2px solid ${k.color}`,background:"rgba(3,11,24,0.7)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <span style={{fontSize:11,color:"#3a6a8a",letterSpacing:2.5,fontWeight:700}}>{k.label}</span>
                  <span style={{fontSize:15,color:k.color}}>{k.icon}</span>
                </div>
                <div style={{fontSize:32,fontWeight:900,color:k.color,fontFamily:"'JetBrains Mono',monospace",lineHeight:1,marginBottom:3}}>{k.value}</div>
                <div style={{fontSize:11,color:"#2a4a6a"}}>{k.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* MAIN GRID */}
        <div style={{flex:1,display:"grid",gridTemplateColumns:"300px 1fr 285px",overflow:"hidden",minHeight:0}}>

          {/* LEFT SIDEBAR */}
          <div style={{borderRight:"1px solid #0d2540",background:"rgba(3,11,24,0.85)",overflowY:"auto",display:"flex",flexDirection:"column"}}>

            {/* Nav tabs with 3D forecast */}
            <div style={{padding:"12px 14px",borderBottom:"1px solid #0d2540",display:"flex",gap:6}}>
              <NavTab label="MAP"      icon="🗺"  active={view==="map"}      onClick={()=>setView("map")}/>
              <NavTab label="TABLE"    icon="📊"  active={view==="table"}    onClick={()=>setView("table")}/>
              <NavTab label="FORECAST" icon="📈"  active={view==="forecast"} onClick={()=>setView("forecast")}/>
            </div>

            {/* Shock sliders */}
            <div style={{padding:"16px 16px 12px"}}>
              <div style={{fontSize:11,letterSpacing:3,color:"rgba(0,212,255,0.65)",marginBottom:16,display:"flex",alignItems:"center",gap:8,fontWeight:700}}>
                <span>⚙</span> SHOCK PARAMETERS
              </div>
              <ShockSlider label="CPI Inflation"     icon="📈" value={shock.cpiIncrease} onChange={v=>setShock(s=>({...s,cpiIncrease:v}))} color="#ff9500"/>
              <ShockSlider label="SNAP Budget Cut"   icon="✂️" value={shock.snapCut}     onChange={v=>setShock(s=>({...s,snapCut:v}))}     color="#ff2d55"/>
              <ShockSlider label="Transit Reduction" icon="🚌" value={shock.transitCut}  onChange={v=>setShock(s=>({...s,transitCut:v}))}  color="#7b2fff"/>
              <ShockSlider label="Income Shock"      icon="💸" value={shock.incomeShock} onChange={v=>setShock(s=>({...s,incomeShock:v}))} color="#00d4ff"/>
            </div>

            {/* Presets */}
            <div style={{padding:"0 16px 14px",borderBottom:"1px solid #0d2540"}}>
              <div style={{fontSize:10,color:"#1e3a52",letterSpacing:2.5,marginBottom:9,fontWeight:700}}>PRESETS</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {[
                  {name:"2022 Inflation",cfg:{cpiIncrease:12,snapCut:0,transitCut:5,incomeShock:8}},
                  {name:"Austerity",     cfg:{cpiIncrease:5,snapCut:30,transitCut:20,incomeShock:15}},
                  {name:"Crisis",        cfg:{cpiIncrease:30,snapCut:25,transitCut:15,incomeShock:25}},
                  {name:"Reset",         cfg:{cpiIncrease:0,snapCut:0,transitCut:0,incomeShock:0}},
                ].map(p=>(
                  <button key={p.name} className="wif-preset" onClick={()=>setShock(p.cfg)} style={{
                    background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.09)",
                    borderRadius:6,padding:"5px 12px",fontSize:10,color:"rgba(255,255,255,0.5)",
                    cursor:"pointer",fontFamily:"'Syne',sans-serif",transition:"all 0.2s",fontWeight:600,
                  }}>{p.name}</button>
                ))}
              </div>
            </div>

            {/* Run button */}
            <div style={{padding:"14px 16px",borderBottom:"1px solid #0d2540"}}>
              <button onClick={runSimulation} disabled={isRunning||loading} style={{
                width:"100%",padding:"14px",
                background:isRunning||loading?"rgba(255,255,255,0.03)":"linear-gradient(135deg,rgba(0,212,255,0.14),rgba(123,47,255,0.18))",
                border:"1px solid rgba(0,212,255,0.32)",borderRadius:9,
                color:isRunning||loading?"rgba(255,255,255,0.2)":"#00d4ff",
                fontSize:12,fontWeight:800,letterSpacing:2.5,cursor:isRunning||loading?"default":"pointer",
                fontFamily:"'JetBrains Mono',monospace",textTransform:"uppercase",transition:"all 0.25s",
                boxShadow:isRunning||loading?"none":"0 0 22px rgba(0,212,255,0.14)",
              }}>
                {isRunning?"◌  SIMULATING...":loading?"◌  LOADING...":"▶  RUN SIMULATION"}
              </button>
              {apiError&&<div style={{fontSize:10,color:"#ff6b6b",marginTop:7,textAlign:"center"}}>⚠ API: {apiError}</div>}
            </div>

            {/* Weight model */}
            <div style={{padding:"13px 16px",borderBottom:"1px solid #0d2540"}}>
              <div style={{fontSize:10,color:"#1e3a52",letterSpacing:2.5,marginBottom:11,fontWeight:700}}>WEIGHT MODEL</div>
              {[
                {k:"XPI · Price Index",  v:"35%",c:"#ff9500"},
                {k:"ACCESS · Food Hubs", v:"28%",c:"#ff2d55"},
                {k:"TRANSIT · Density",  v:"20%",c:"#7b2fff"},
                {k:"INCOME · Median",    v:"17%",c:"#00d4ff"},
              ].map(({k,v,c})=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:7,alignItems:"center"}}>
                  <span style={{fontSize:11,color:"#3a5a72",fontWeight:600}}>{k}</span>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:40,height:4,background:"rgba(255,255,255,0.05)",borderRadius:2,overflow:"hidden"}}>
                      <div style={{height:"100%",width:v,background:c,borderRadius:2}}/>
                    </div>
                    <span style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:c,fontWeight:800}}>{v}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Baseline stats */}
            {!hasRun&&nationalStats&&(
              <div style={{padding:"13px 16px",borderBottom:"1px solid #0d2540"}}>
                <div style={{fontSize:10,color:"rgba(0,212,255,0.55)",letterSpacing:2.5,marginBottom:11,fontWeight:700}}>NATIONAL BASELINE (API)</div>
                {[
                  {l:"National Avg", v:Math.round(Number(nationalStats.avg_score)),  c:getScoreColor(Number(nationalStats.avg_score))},
                  {l:"Top State",    v:nationalStats.top_state_code,                  c:"#00ffa3"},
                  {l:"Critical",     v:nationalStats.critical_count,                  c:"#ff2d55"},
                  {l:"Dispersion",   v:Math.round(Number(nationalStats.dispersion)),  c:"#ff9500"},
                ].map(({l,v,c})=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:8,alignItems:"center"}}>
                    <span style={{fontSize:11,color:"#3a5a72",fontWeight:600}}>{l}</span>
                    <span style={{fontSize:15,fontFamily:"'JetBrains Mono',monospace",fontWeight:800,color:c}}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Impact bars */}
            {hasRun&&results.length>0&&(
              <div style={{padding:"13px 16px",borderBottom:"1px solid #0d2540"}}>
                <ImpactBars results={results}/>
              </div>
            )}

            {/* Prediction mini list */}
            {predSummaries.length > 0 && (
              <div style={{padding:"13px 16px"}}>
                <PredictionMiniList summaries={predSummaries} onSelect={(s) => { setSelectedPredState(s); setView("forecast"); }}/>
              </div>
            )}
          </div>

          {/* CENTER PANEL */}
          <div style={{display:"flex",flexDirection:"column",background:"rgba(3,11,24,0.7)",overflow:"hidden"}}>
            <div style={{padding:"10px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #0d2540",flexShrink:0}}>
              <div>
                
                <div style={{fontSize:16,fontWeight:800,color:"#e0f4ff",marginTop:2}}>
                  {view==="forecast" ? "PREDICTIVE RESILIENCE FORECAST" : "USA MAP FOOD RESILIENCE "}
                </div>
              </div>
              {/* Score legend with numbers */}
              {view !== "forecast" && <ScoreLegend />}
              {view === "forecast" && (
                <div style={{display:"flex",gap:16,alignItems:"center"}}>
                  {[{c:"#00ffa3",l:"Low"},{c:"#00d4ff",l:"Medium"},{c:"#ff9500",l:"High"},{c:"#ff2d55",l:"Critical"}].map(l=>(
                    <span key={l.l} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"rgba(255,255,255,0.5)",fontWeight:600}}>
                      <span style={{width:11,height:11,borderRadius:3,background:l.c,display:"inline-block",boxShadow:`0 0 5px ${l.c}`}}/>
                      {l.l}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* MAP */}
            {view==="map"&&(
              <div style={{flex:1,position:"relative",minHeight:0}}>
                {loading ? (
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",flexDirection:"column",gap:14}}>
                    <div style={{width:36,height:36,border:"2px solid rgba(0,212,255,0.18)",borderTop:"2px solid #00d4ff",borderRadius:"50%",animation:"wif-spin 1s linear infinite"}}/>
                    <span style={{fontSize:13,color:"rgba(0,212,255,0.55)",letterSpacing:3}}>LOADING DATA...</span>
                  </div>
                ) : (
                  <>
                    {!hasRun&&(
                      <div style={{position:"absolute",inset:0,zIndex:3,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,background:"rgba(3,11,24,0.55)",backdropFilter:"blur(3px)"}}>
                        <div style={{fontSize:44}}>⚡</div>
                        <div style={{fontSize:14,color:"rgba(255,255,255,0.5)",letterSpacing:2.5,fontWeight:700}}>SET PARAMETERS & RUN SIMULATION</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",letterSpacing:1}}>Showing baseline scores from API</div>
                      </div>
                    )}
                    <USMap3D results={displayResults} hasRun={hasRun} onHover={handleMapHover} onSelect={handleMapSelect} selectedCode={selectedState?.state_code??null}/>
                    {hoveredState&&(()=>{
                      const score = hasRun?hoveredState.newScore:Math.round(Number(hoveredState.composite_score));
                      const color = getScoreColor(score);
                      const pop = getPopulation(hoveredState.state_name, Number(hoveredState.population_2020));
                      return (
                        <div style={{
                          position:"absolute",left:Math.min(tooltipPos.x+14,window.innerWidth-240),
                          top:Math.max(tooltipPos.y-75,8),
                          background:"rgba(3,11,24,0.97)",border:`1px solid ${color}50`,
                          borderRadius:10,padding:"13px 16px",minWidth:200,zIndex:100,
                          backdropFilter:"blur(20px)",boxShadow:`0 14px 36px rgba(0,0,0,0.7),0 0 24px ${color}12`,
                          pointerEvents:"none",
                        }}>
                          <div style={{fontSize:15,fontWeight:800,color:"#e8f4ff",marginBottom:3}}>{hoveredState.state_name}</div>
                          <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",letterSpacing:2,marginBottom:8,fontWeight:600}}>
                            {hoveredState.region} · {hoveredState.state_code}
                            {pop > 0 && ` · ${(pop/1e6).toFixed(2)}M`}
                          </div>
                          <div style={{display:"flex",gap:12,marginBottom:9}}>
                            <div>
                              <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",marginBottom:1,letterSpacing:1}}>BASELINE</div>
                              <div style={{fontSize:22,fontWeight:900,color:getScoreColor(Math.round(Number(hoveredState.composite_score))),fontFamily:"'JetBrains Mono',monospace"}}>{Math.round(Number(hoveredState.composite_score))}</div>
                            </div>
                            {hasRun&&<>
                              <div style={{width:1,background:"rgba(255,255,255,0.08)"}}/>
                              <div>
                                <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",marginBottom:1,letterSpacing:1}}>SIMULATED</div>
                                <div style={{fontSize:22,fontWeight:900,color:getScoreColor(hoveredState.newScore),fontFamily:"'JetBrains Mono',monospace"}}>{hoveredState.newScore}</div>
                              </div>
                              <div>
                                <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",marginBottom:1,letterSpacing:1}}>Δ</div>
                                <div style={{fontSize:22,fontWeight:900,color:hoveredState.delta<0?"#ff2d55":"#00ffa3",fontFamily:"'JetBrains Mono',monospace"}}>{hoveredState.delta>0?"+":""}{hoveredState.delta}</div>
                              </div>
                            </>}
                          </div>
                          {(()=>{
                            const pred = predSummaries.find(s => s.state_code === hoveredState.state_code);
                            if (!pred) return null;
                            const score2026 = pred.scores.find(s=>s.year===2026);
                            if (!score2026) return null;
                            return (
                              <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                                <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",marginBottom:4,letterSpacing:1.5,fontWeight:700}}>ML FORECAST 2026</div>
                                <div style={{display:"flex",alignItems:"center",gap:9}}>
                                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:800,color:getRiskColor(score2026.risk)}}>{score2026.score.toFixed(1)}</span>
                                  <span style={{fontSize:10,letterSpacing:1,color:getRiskColor(score2026.risk),background:`${getRiskColor(score2026.risk)}12`,border:`1px solid ${getRiskColor(score2026.risk)}30`,padding:"2px 8px",borderRadius:4,fontWeight:700}}>{score2026.risk.toUpperCase()}</span>
                                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:pred.trend==="up"?"#00ffa3":pred.trend==="down"?"#ff2d55":"#ff9500",fontWeight:800}}>
                                    {pred.trend==="up"?"↑":pred.trend==="down"?"↓":"→"}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                          <div style={{marginTop:8,fontSize:10,letterSpacing:1.5,color,background:`${color}15`,border:`1px solid ${color}40`,padding:"3px 9px",borderRadius:5,display:"inline-block",fontWeight:700}}>{getRiskLabel(score)}</div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* TABLE */}
            {view==="table"&&hasRun&&(
              <div style={{flex:1,overflowY:"auto"}}>
                <div style={{display:"grid",gridTemplateColumns:"60px 1fr 60px 60px 60px 100px",padding:"8px 16px",fontSize:10,letterSpacing:2,color:"#4a7a9a",fontWeight:700,borderBottom:"1px solid #0d2540",position:"sticky",top:0,background:"rgba(3,11,24,0.98)",backdropFilter:"blur(8px)"}}>
                  <span>CODE</span>
                  <div style={{display:"flex",gap:10}}>
                    <button onClick={()=>setSortBy("delta")} style={{background:"none",border:"none",color:sortBy==="delta"?"#00d4ff":"inherit",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontSize:10,letterSpacing:2,fontWeight:700}}>↑ Δ</button>
                    <button onClick={()=>setSortBy("score")} style={{background:"none",border:"none",color:sortBy==="score"?"#00d4ff":"inherit",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontSize:10,letterSpacing:2,fontWeight:700}}>SCORE</button>
                  </div>
                  <span>BASE</span><span>NEW</span><span>Δ</span><span>STATUS</span>
                </div>
                {sortedResults.map(r=>{
                  const pop = getPopulation(r.state_name, Number(r.population_2020));
                  return (
                    <div key={r.state_code} className="wif-row" onClick={()=>setSelectedState(r)} style={{
                      display:"grid",gridTemplateColumns:"60px 1fr 60px 60px 60px 100px",
                      padding:"9px 16px",borderBottom:"1px solid rgba(255,255,255,0.04)",
                      alignItems:"center",cursor:"pointer",
                      background:r.critical?"rgba(255,45,85,0.03)":"transparent",
                    }}>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:800}}>{r.state_code}</span>
                      <div>
                        <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",fontWeight:600}}>{r.state_name}</div>
                        {pop>0&&<div style={{fontSize:10,color:"rgba(255,255,255,0.25)",fontFamily:"'JetBrains Mono',monospace"}}>{(pop/1e6).toFixed(1)}M</div>}
                      </div>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:getScoreColor(Math.round(Number(r.composite_score))),fontWeight:700}}>{Math.round(Number(r.composite_score))}</span>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:getScoreColor(r.newScore),fontWeight:700}}>{r.newScore}</span>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:r.delta<0?"#ff2d55":"#00ffa3",fontWeight:700}}>{r.delta>0?"+":""}{r.delta}</span>
                      <span style={{fontSize:10,letterSpacing:1,color:getScoreColor(r.newScore),background:`${getScoreColor(r.newScore)}10`,border:`1px solid ${getScoreColor(r.newScore)}25`,padding:"3px 7px",borderRadius:4,fontWeight:700}}>{getRiskLabel(r.newScore)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {view==="table"&&!hasRun&&(
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,color:"rgba(255,255,255,0.3)",fontSize:14,letterSpacing:2,fontWeight:700}}>
                <div style={{fontSize:42}}>📊</div>RUN SIMULATION TO SEE TABLE
              </div>
            )}

            {/* FORECAST */}
            {view==="forecast"&&(
              <ForecastView summaries={predSummaries} loading={predLoading} selectedPredState={selectedPredState} onSelect={setSelectedPredState}/>
            )}

            {/* Regional strip */}
            {displayResults.length>0&&view!=="forecast"&&(
              <div style={{padding:"11px 16px",borderTop:"1px solid #0d2540",flexShrink:0}}>
                <div style={{fontSize:10,color:"#2a4a6a",letterSpacing:3,marginBottom:8,fontWeight:700}}>REGIONAL AVERAGES</div>
                <RegionalHeatStrip results={displayResults} hasRun={hasRun}/>
              </div>
            )}
            {hasRun&&view!=="forecast"&&(
              <div style={{padding:"9px 16px 11px",borderTop:"1px solid #0d2540",display:"flex",flexWrap:"wrap",gap:16,alignItems:"center",flexShrink:0}}>
                <div style={{fontSize:10,letterSpacing:3,color:"rgba(0,212,255,0.5)",fontWeight:700}}>SCENARIO IMPACT</div>
                {[
                  {l:"DECLINING",    v:results.filter(r=>r.delta<0).length},
                  {l:"NEW CRITICAL", v:results.filter(r=>r.critical&&Math.round(Number(r.composite_score))>=50).length},
                  {l:"WORST DROP",   v:`${Math.min(...results.map(r=>r.delta))}pts`},
                  {l:"CPI",          v:`+${shock.cpiIncrease}%`},
                  {l:"SNAP",         v:`-${shock.snapCut}%`},
                  {l:"TRANSIT",      v:`-${shock.transitCut}%`},
                  {l:"INCOME",       v:`-${shock.incomeShock}%`},
                ].map(item=>(
                  <div key={item.l}>
                    <div style={{fontSize:9,color:"#1e3a52",letterSpacing:1,marginBottom:2,fontWeight:600}}>{item.l}</div>
                    <div style={{fontSize:16,fontWeight:900,fontFamily:"'JetBrains Mono',monospace",color:"white"}}>{item.v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div style={{borderLeft:"1px solid #0d2540",background:"rgba(3,11,24,0.85)",overflowY:"auto",display:"flex",flexDirection:"column"}}>

            {/* Worst states list */}
            <div style={{padding:"14px 14px",borderBottom:"1px solid #0d2540"}}>
              <div style={{fontSize:11,letterSpacing:2.5,color:"#ff2d55",marginBottom:12,display:"flex",alignItems:"center",gap:7,fontWeight:700}}>
                <span>⚠</span> {hasRun?"MOST IMPACTED":"LOWEST BASELINE"}
              </div>
              {loading ? (
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:70}}>
                  <div style={{width:28,height:28,border:"2px solid rgba(0,212,255,0.15)",borderTop:"2px solid #00d4ff",borderRadius:"50%",animation:"wif-spin 1s linear infinite"}}/>
                </div>
              ) : worstStates.map((r,i)=>{
                const pop = getPopulation(r.state_name, Number(r.population_2020));
                return (
                  <div key={r.state_code} onClick={()=>setSelectedState(r)} style={{
                    display:"flex",alignItems:"center",gap:9,marginBottom:7,
                    padding:"8px 10px",borderRadius:7,cursor:"pointer",
                    background:selectedState?.state_code===r.state_code?"rgba(0,212,255,0.07)":hasRun&&r.critical?"rgba(255,45,85,0.04)":"rgba(255,255,255,0.02)",
                    border:selectedState?.state_code===r.state_code?"1px solid rgba(0,212,255,0.22)":"1px solid rgba(255,255,255,0.04)",
                    transition:"all 0.2s",
                  }}>
                    <span style={{fontSize:10,color:"#1e3a52",fontFamily:"'JetBrains Mono',monospace",width:14,fontWeight:700}}>{i+1}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.65)",fontWeight:600}}>{r.state_name}</div>
                      {pop>0&&<div style={{fontSize:10,color:"rgba(255,255,255,0.25)",fontFamily:"'JetBrains Mono',monospace"}}>{(pop/1e6).toFixed(2)}M</div>}
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:800,color:getScoreColor(r.newScore)}}>{r.newScore}</div>
                      {hasRun&&r.delta!==0&&<div style={{fontSize:10,color:r.delta<0?"#ff2d55":"#00ffa3",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{r.delta>0?"+":""}{r.delta}</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* State detail panel */}
            {selectedState&&view!=="forecast"&&(
              <div className="wif-card" style={{padding:"14px 14px",borderBottom:"1px solid #0d2540"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:800,color:"#e8f4ff"}}>{selectedState.state_name}</div>
                    <div style={{fontSize:10,color:"#3a6a8a",letterSpacing:2,marginTop:2,fontWeight:600}}>
                      {selectedState.state_code} · {selectedState.region}
                      {(()=>{ const pop = getPopulation(selectedState.state_name, Number(selectedState.population_2020)); return pop>0 ? ` · ${(pop/1e6).toFixed(2)}M` : ""; })()}
                    </div>
                  </div>
                  <button onClick={()=>setSelectedState(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.25)",cursor:"pointer",fontSize:19,lineHeight:1}}>×</button>
                </div>
                <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
                  <ScoreArc score={selectedState.newScore}/>
                </div>
                <FactorBar label="XPI / CPI" value={Math.round(Number(selectedState.xpi_score)+selectedState.factorDeltas.xpi)}      delta={selectedState.factorDeltas.xpi}     color="#ff9500"/>
                <FactorBar label="ACCESS"    value={Math.round(Number(selectedState.access_score)+selectedState.factorDeltas.access)}  delta={selectedState.factorDeltas.access}  color="#00d4ff"/>
                <FactorBar label="TRANSIT"   value={Math.round(Number(selectedState.transit_score)+selectedState.factorDeltas.transit)} delta={selectedState.factorDeltas.transit} color="#7b2fff"/>
                <FactorBar label="INCOME"    value={Math.round(Number(selectedState.income_score)+selectedState.factorDeltas.income)}   delta={selectedState.factorDeltas.income}  color="#00ffa3"/>

                {(()=>{
                  const pred = predSummaries.find(s => s.state_code === selectedState.state_code);
                  if (!pred) return null;
                  return (
                    <div style={{marginTop:12,padding:"10px 11px",background:"rgba(0,212,255,0.04)",borderRadius:7,border:"1px solid rgba(0,212,255,0.12)"}}>
                      <div style={{fontSize:10,color:"rgba(0,212,255,0.6)",letterSpacing:2,marginBottom:8,fontWeight:700}}>📈 ML FORECAST</div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{display:"flex",gap:12}}>
                          {pred.scores.map(sc=>(
                            <div key={sc.year} style={{textAlign:"center"}}>
                              <div style={{fontSize:9,color:"#3a6a8a",marginBottom:2,fontWeight:700}}>{sc.year}</div>
                              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:800,color:getRiskColor(sc.risk)}}>{sc.score.toFixed(0)}</div>
                            </div>
                          ))}
                        </div>
                        <PredictionSparkline scores={pred.scores} color={pred.trend==="up"?"#00ffa3":pred.trend==="down"?"#ff2d55":"#ff9500"}/>
                      </div>
                    </div>
                  );
                })()}

                <div style={{marginTop:10,padding:"6px 12px",background:`${getScoreColor(selectedState.newScore)}0e`,border:`1px solid ${getScoreColor(selectedState.newScore)}2e`,borderRadius:6,fontSize:11,letterSpacing:1.5,color:getScoreColor(selectedState.newScore),textAlign:"center",fontWeight:700}}>
                  {getRiskLabel(selectedState.newScore)}
                </div>
              </div>
            )}

            {selectedPredState && view==="forecast" && <PredictionDetailPanel summary={selectedPredState}/>}

            {/* Resilience scale */}
            <div style={{padding:"13px 14px",borderBottom:"1px solid #0d2540"}}>
              <div style={{fontSize:10,color:"#1e3a52",letterSpacing:2.5,marginBottom:10,fontWeight:700}}>RESILIENCE SCALE</div>
              <div style={{height:8,borderRadius:4,background:"linear-gradient(to right,#ff2d55,#ff9500,#00d4ff,#00ffa3)",boxShadow:"0 0 10px rgba(0,212,255,0.18)",marginBottom:6}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"rgba(255,255,255,0.35)",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>
                <span>0 CRIT</span><span>45 HIGH</span><span>60 MED</span><span>75 LOW</span>
              </div>
            </div>

            {/* Simulation stats */}
            {hasRun&&avgNewScore!==null&&(
              <div style={{padding:"13px 14px"}}>
                <div style={{fontSize:10,color:"#1e3a52",letterSpacing:2.5,marginBottom:11,fontWeight:700}}>SIMULATION STATS</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[
                    {l:"AVG SCORE", v:avgNewScore,                    c:getScoreColor(avgNewScore)},
                    {l:"AVG DELTA", v:`${avgDelta>0?"+":""}${avgDelta}`, c:avgDelta<0?"#ff2d55":"#00ffa3"},
                    {l:"CRITICAL",  v:criticalCount,                  c:"#ff2d55"},
                    {l:"AT RISK",   v:`${(popAtRisk/1e6).toFixed(1)}M`, c:"#ff9500"},
                  ].map(k=>(
                    <div key={k.l} style={{padding:"10px 12px",borderRadius:7,background:`${k.c}07`,border:`1px solid ${k.c}1e`}}>
                      <div style={{fontSize:9,color:"#3a5a72",letterSpacing:1.5,marginBottom:4,fontWeight:700}}>{k.l}</div>
                      <div style={{fontSize:20,fontWeight:900,color:k.c,fontFamily:"'JetBrains Mono',monospace"}}>{k.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div style={{borderTop:"1px solid #0d2540",padding:"6px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(3,11,24,0.9)",fontSize:10,color:"#1a3a5a",letterSpacing:2,flexShrink:0,fontWeight:600}}>
          <span>FOOD RESILIENCE INTELLIGENCE · CPI · ACCESS · TRANSIT · INCOME · ML FORECAST</span>
          <span style={{color:"#00ffa338"}}>● POSTGRESQL · {states.length} STATES · {predSummaries.length} PREDICTED</span>
          <span>© 2026 INTELLIGENCE PLATFORM</span>
        </div>
      </div>
    </div>
  );
}