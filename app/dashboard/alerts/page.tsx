"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

// ─── Types ────────────────────────────────────────────────────────────────────
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

interface Alert {
  id: string;
  state_code: string;
  state_name: string;
  type: "CRITICAL" | "WARNING" | "WATCH" | "INFO";
  dimension: "Food Security" | "Logistics" | "Market" | "Income" | "Access";
  score: number;
  threshold: number;
  delta: number;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const SEV = {
  CRITICAL: { color: "#ff3b5c", glow: "rgba(255,59,92,0.4)",  bg: "rgba(255,59,92,0.10)"  },
  WARNING:  { color: "#ffaa00", glow: "rgba(255,170,0,0.4)",   bg: "rgba(255,170,0,0.10)"  },
  WATCH:    { color: "#00d4ff", glow: "rgba(0,212,255,0.4)",   bg: "rgba(0,212,255,0.10)"  },
  INFO:     { color: "#00ff9d", glow: "rgba(0,255,157,0.4)",   bg: "rgba(0,255,157,0.10)"  },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function scoreColor(v: number) {
  return v < 40 ? "#ff3b5c" : v < 55 ? "#ffaa00" : "#00ff9d";
}

function generateAlerts(states: StateData[]): Alert[] {
  const list: Alert[] = [];
  const now = Date.now();
  states.forEach((s) => {
    const c = Number(s.composite_score), a = Number(s.access_score),
          t = Number(s.transit_score),   i = Number(s.income_score),
          x = Number(s.xpi_score);
    if (c < 40)  list.push({ id:`${s.state_code}-comp-crit`,state_code:s.state_code,state_name:s.state_name,type:"CRITICAL",dimension:"Food Security",score:c,threshold:40,delta:c-40,message:`Composite resilience ${c.toFixed(1)} critically below threshold 40 — immediate intervention required`,timestamp:new Date(now-Math.random()*3_600_000),acknowledged:false });
    else if(c<50)list.push({ id:`${s.state_code}-comp-warn`,state_code:s.state_code,state_name:s.state_name,type:"WARNING", dimension:"Food Security",score:c,threshold:50,delta:c-50,message:`Composite score ${c.toFixed(1)} approaching critical zone (threshold 50) — monitor closely`,timestamp:new Date(now-Math.random()*7_200_000),acknowledged:false });
    if (a < 45)  list.push({ id:`${s.state_code}-access`,state_code:s.state_code,state_name:s.state_name,type:a<35?"CRITICAL":"WARNING",dimension:"Access",score:a,threshold:45,delta:a-45,message:`Food access index ${a.toFixed(1)} below threshold 45 — supply chain disruption risk elevated`,timestamp:new Date(now-Math.random()*5_400_000),acknowledged:false });
    if (t < 40)  list.push({ id:`${s.state_code}-transit`,state_code:s.state_code,state_name:s.state_name,type:t<30?"WARNING":"WATCH",dimension:"Logistics",score:t,threshold:40,delta:t-40,message:`Transit density ${t.toFixed(1)} below 40 — distribution network fragility detected`,timestamp:new Date(now-Math.random()*10_800_000),acknowledged:false });
    if (i < 45)  list.push({ id:`${s.state_code}-income`,state_code:s.state_code,state_name:s.state_name,type:i<38?"WARNING":"WATCH",dimension:"Income",score:i,threshold:45,delta:i-45,message:`Economic resilience ${i.toFixed(1)} below 45 — household food vulnerability elevated`,timestamp:new Date(now-Math.random()*14_400_000),acknowledged:false });
    if (x > 72)  list.push({ id:`${s.state_code}-market`,state_code:s.state_code,state_name:s.state_name,type:"INFO",dimension:"Market",score:x,threshold:72,delta:x-72,message:`CPI pressure index ${x.toFixed(1)} exceeds benchmark 72 — price inflation risk above national average`,timestamp:new Date(now-Math.random()*18_000_000),acknowledged:false });
  });
  return list.sort((a,b)=>{ const o={CRITICAL:0,WARNING:1,WATCH:2,INFO:3}; return o[a.type]-o[b.type]||b.timestamp.getTime()-a.timestamp.getTime(); });
}

// ─── Radar Chart ──────────────────────────────────────────────────────────────
function RadarChart({ state }: { state: StateData }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const W=240,H=240,cx=120,cy=120,R=86;
    const dims=[
      {label:"CPI",      v:Number(state.xpi_score)/100},
      {label:"Access",   v:Number(state.access_score)/100},
      {label:"Transit",  v:Number(state.transit_score)/100},
      {label:"Income",   v:Number(state.income_score)/100},
      {label:"Composite",v:Number(state.composite_score)/100},
    ];
    const N=dims.length, slice=(Math.PI*2)/N;
    [.2,.4,.6,.8,1].forEach(t=>{
      const pts=dims.map((_,i)=>{ const a=slice*i-Math.PI/2; return `${cx+R*t*Math.cos(a)},${cy+R*t*Math.sin(a)}`; }).join(" ");
      svg.append("polygon").attr("points",pts).attr("fill","none").attr("stroke",`rgba(0,212,255,${t===1?0.18:0.07})`).attr("stroke-width",t===1?0.8:0.4);
    });
    dims.forEach((_,i)=>{ const a=slice*i-Math.PI/2;
      svg.append("line").attr("x1",cx).attr("y1",cy).attr("x2",cx+R*Math.cos(a)).attr("y2",cy+R*Math.sin(a)).attr("stroke","rgba(0,212,255,0.1)").attr("stroke-width",0.5);
    });
    const col=scoreColor(Number(state.composite_score));
    const pts=dims.map((d,i)=>{ const a=slice*i-Math.PI/2; return [cx+R*d.v*Math.cos(a),cy+R*d.v*Math.sin(a)] as [number,number]; });
    const defs=svg.append("defs");
    const rg=defs.append("radialGradient").attr("id",`rg${state.state_code}`);
    rg.append("stop").attr("offset","0%").attr("stop-color",col).attr("stop-opacity",0.5);
    rg.append("stop").attr("offset","100%").attr("stop-color",col).attr("stop-opacity",0.04);
    svg.append("polygon").attr("points",pts.map(p=>p.join(",")).join(" ")).attr("fill",`url(#rg${state.state_code})`).attr("stroke",col).attr("stroke-width",2).attr("stroke-linejoin","round");
    pts.forEach(([x,y])=>svg.append("circle").attr("cx",x).attr("cy",y).attr("r",4).attr("fill",col).attr("filter",`drop-shadow(0 0 5px ${col})`));
    dims.forEach((d,i)=>{ const a=slice*i-Math.PI/2;
      svg.append("text").attr("x",cx+(R+18)*Math.cos(a)).attr("y",cy+(R+18)*Math.sin(a))
        .attr("text-anchor","middle").attr("dominant-baseline","central")
        .attr("fill","rgba(180,210,255,0.7)").attr("font-size","11px").attr("font-family","'IBM Plex Mono',monospace").attr("font-weight","500")
        .text(d.label);
    });
  },[state]);
  return <svg ref={ref} width={240} height={240} style={{display:"block"}} />;
}

// ─── Arc Gauge ────────────────────────────────────────────────────────────────
function Gauge({ value, label, size=90 }: { value:number; label:string; size?:number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const svg=d3.select(ref.current); svg.selectAll("*").remove();
    const cx=size/2,cy=size/2,r=size*0.38,sw=size*0.09;
    const pct=Math.min(Math.max(Number(value),0),100)/100;
    const col=scoreColor(Number(value));
    const sa=-Math.PI*0.8;
    const arc=d3.arc<{end:number}>().innerRadius(r-sw/2).outerRadius(r+sw/2).startAngle(sa).endAngle(d=>d.end).cornerRadius(2);
    svg.append("path").datum({end:Math.PI*0.8}).attr("d",arc).attr("fill","rgba(255,255,255,0.05)").attr("transform",`translate(${cx},${cy})`);
    svg.append("path").datum({end:sa+pct*Math.PI*1.6}).attr("d",arc).attr("fill",col).attr("filter",`drop-shadow(0 0 6px ${col})`).attr("transform",`translate(${cx},${cy})`);
    svg.append("text").attr("x",cx).attr("y",cy+2).attr("text-anchor","middle").attr("dominant-baseline","central")
      .attr("fill",col).attr("font-size",`${size*0.2}px`).attr("font-family","'IBM Plex Mono',monospace").attr("font-weight","700").text(Number(value).toFixed(0));
    svg.append("text").attr("x",cx).attr("y",cy+size*0.24).attr("text-anchor","middle")
      .attr("fill","rgba(180,210,255,0.5)").attr("font-size",`${size*0.11}px`).attr("font-family","'IBM Plex Mono',monospace").text(label);
  },[value,label,size]);
  return <svg ref={ref} width={size} height={size} />;
}

// ─── Pulse Dot ────────────────────────────────────────────────────────────────
function Pulse({ type }: { type: Alert["type"] }) {
  const {color,glow}=SEV[type];
  return (
    <span style={{position:"relative",display:"inline-flex",width:14,height:14,alignItems:"center",justifyContent:"center",flexShrink:0}}>
      {type==="CRITICAL"&&<span style={{position:"absolute",width:14,height:14,borderRadius:"50%",background:color,opacity:.22,animation:"pulseRing 1.2s ease-out infinite",boxShadow:`0 0 8px ${glow}`}} />}
      <span style={{width:8,height:8,borderRadius:"50%",background:color,boxShadow:`0 0 6px ${glow}`,position:"relative"}} />
    </span>
  );
}

// ─── Score Sparkline ──────────────────────────────────────────────────────────
function ScoreSparkline({ states, national }: { states:StateData[]; national:NationalStats }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current||states.length===0) return;
    const svg=d3.select(ref.current); svg.selectAll("*").remove();
    const W=320,H=70;
    const scores=states.map(s=>Number(s.composite_score)).sort((a,b)=>a-b);
    const x=d3.scaleLinear().domain([0,scores.length-1]).range([0,W]);
    const y=d3.scaleLinear().domain([0,100]).range([H,0]);
    const defs=svg.append("defs");
    const lg=defs.append("linearGradient").attr("id","sG").attr("x1","0%").attr("x2","100%");
    lg.append("stop").attr("offset","0%").attr("stop-color","#ff3b5c");
    lg.append("stop").attr("offset","40%").attr("stop-color","#ffaa00");
    lg.append("stop").attr("offset","85%").attr("stop-color","#00ff9d");
    const ag=defs.append("linearGradient").attr("id","aG").attr("x1","0").attr("y1","0").attr("x2","0").attr("y2","1");
    ag.append("stop").attr("offset","0%").attr("stop-color","#00d4ff").attr("stop-opacity",.18);
    ag.append("stop").attr("offset","100%").attr("stop-color","#00d4ff").attr("stop-opacity",0);
    const aFn=d3.area<number>().x((_,i)=>x(i)).y0(H).y1(d=>y(d)).curve(d3.curveCatmullRom);
    const lFn=d3.line<number>().x((_,i)=>x(i)).y(d=>y(d)).curve(d3.curveCatmullRom);
    svg.append("path").datum(scores).attr("d",aFn).attr("fill","url(#aG)");
    svg.append("path").datum(scores).attr("d",lFn).attr("fill","none").attr("stroke","url(#sG)").attr("stroke-width",2);
    svg.append("line").attr("x1",0).attr("y1",y(50)).attr("x2",W).attr("y2",y(50)).attr("stroke","rgba(255,170,0,0.35)").attr("stroke-width",0.6).attr("stroke-dasharray","4,3");
    const idx=scores.findIndex(s=>s>=Number(national.avg_score));
    if(idx>=0) svg.append("line").attr("x1",x(idx)).attr("y1",0).attr("x2",x(idx)).attr("y2",H).attr("stroke","rgba(0,212,255,0.3)").attr("stroke-width",0.6).attr("stroke-dasharray","2,2");
  },[states,national]);
  return (
    <div>
      <svg ref={ref} width={320} height={70} style={{display:"block",width:"100%"}} viewBox="0 0 320 70" preserveAspectRatio="none" />
      <div style={{display:"flex",justifyContent:"space-between",marginTop:7}}>
        <span style={{fontSize:13,color:"#ff3b5c",fontFamily:"'IBM Plex Mono',monospace",fontWeight:600}}>MIN {Number(national.min_score).toFixed(0)}</span>
        <span style={{fontSize:13,color:"rgba(0,212,255,0.5)",fontFamily:"'IBM Plex Mono',monospace"}}>AVG {Number(national.avg_score).toFixed(0)}</span>
        <span style={{fontSize:13,color:"#00ff9d",fontFamily:"'IBM Plex Mono',monospace",fontWeight:600}}>MAX {Number(national.max_score).toFixed(0)}</span>
      </div>
    </div>
  );
}

// ─── Alert Timeline ───────────────────────────────────────────────────────────
function AlertTimeline({ alerts }: { alerts:Alert[] }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const svg=d3.select(ref.current); svg.selectAll("*").remove();
    const W=320,H=80;
    const now=Date.now();
    const buckets=Array.from({length:6},(_,i)=>{
      const start=now-(6-i)*3_600_000, end=start+3_600_000;
      return {i,total:alerts.filter(a=>a.timestamp.getTime()>=start&&a.timestamp.getTime()<end).length,
              critical:alerts.filter(a=>a.type==="CRITICAL"&&a.timestamp.getTime()>=start&&a.timestamp.getTime()<end).length};
    });
    const x=d3.scaleBand().domain(buckets.map(b=>String(b.i))).range([0,W]).padding(0.3);
    const y=d3.scaleLinear().domain([0,Math.max(d3.max(buckets,b=>b.total)??1,1)]).range([H-18,4]);
    const defs=svg.append("defs");
    const bg=defs.append("linearGradient").attr("id","bG").attr("x1","0").attr("y1","0").attr("x2","0").attr("y2","1");
    bg.append("stop").attr("offset","0%").attr("stop-color","#00d4ff").attr("stop-opacity",.7);
    bg.append("stop").attr("offset","100%").attr("stop-color","#00d4ff").attr("stop-opacity",.1);
    buckets.forEach(b=>{
      const bx=x(String(b.i))??0, bw=x.bandwidth(), bH=Math.max((H-18)-y(b.total),0);
      if(b.total>0){
        svg.append("rect").attr("x",bx).attr("y",y(b.total)).attr("width",bw).attr("height",bH)
          .attr("fill",b.critical>0?"rgba(255,59,92,0.55)":"url(#bG)").attr("rx",3)
          .attr("filter",b.critical>0?`drop-shadow(0 0 4px rgba(255,59,92,0.5))`:`drop-shadow(0 0 3px rgba(0,212,255,0.4))`);
        svg.append("text").attr("x",bx+bw/2).attr("y",y(b.total)-5).attr("text-anchor","middle")
          .attr("fill",b.critical>0?"#ff3b5c":"rgba(0,212,255,0.8)").attr("font-size","12px").attr("font-family","'IBM Plex Mono',monospace").attr("font-weight","600")
          .text(String(b.total));
      }
      svg.append("text").attr("x",bx+bw/2).attr("y",H-2).attr("text-anchor","middle")
        .attr("fill","rgba(180,210,255,0.35)").attr("font-size","10px").attr("font-family","'IBM Plex Mono',monospace")
        .text(`${6-b.i}h`);
    });
  },[alerts]);
  return <svg ref={ref} width={320} height={80} style={{display:"block",width:"100%"}} viewBox="0 0 320 80" preserveAspectRatio="none" />;
}

// ─── Dimension Heatmap Row ─────────────────────────────────────────────────────
function DimHeatmap({ states }: { states:StateData[] }) {
  const dims=[
    {key:"composite_score",label:"Composite"},
    {key:"access_score",   label:"Access"},
    {key:"transit_score",  label:"Transit"},
    {key:"income_score",   label:"Income"},
    {key:"xpi_score",      label:"CPI"},
  ] as const;
  const top5=states.slice(0,5);
  if(top5.length===0) return null;
  return (
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"'IBM Plex Mono',monospace",fontSize:11}}>
        <thead>
          <tr>
            <th style={{textAlign:"left",padding:"5px 6px",color:"rgba(180,210,255,0.35)",fontSize:9,letterSpacing:"0.12em",fontWeight:400}}>STATE</th>
            {dims.map(d=><th key={d.key} style={{padding:"5px 6px",color:"rgba(180,210,255,0.35)",fontSize:9,letterSpacing:"0.12em",fontWeight:400,textAlign:"center"}}>{d.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {top5.map(s=>(
            <tr key={s.state_code}>
              <td style={{padding:"5px 6px",color:"rgba(180,210,255,0.7)",whiteSpace:"nowrap"}}>{s.state_code}</td>
              {dims.map(d=>{
                const v=Number(s[d.key]);
                const col=scoreColor(v);
                return (
                  <td key={d.key} style={{padding:"4px 6px",textAlign:"center"}}>
                    <div style={{background:`${col}22`,border:`1px solid ${col}44`,borderRadius:4,padding:"2px 6px",color:col,fontSize:10,fontWeight:600,boxShadow:`0 0 4px ${col}33`}}>
                      {v.toFixed(0)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Top Declining Widget ──────────────────────────────────────────────────────
function TopDeclining({ states }: { states:StateData[] }) {
  const sorted=[...states].sort((a,b)=>Number(a.composite_score)-Number(b.composite_score)).slice(0,5);
  return (
    <div>
      {sorted.map((s,i)=>{
        const v=Number(s.composite_score); const col=scoreColor(v); const pct=v;
        return (
          <div key={s.state_code} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:12,color:"rgba(180,210,255,0.8)",fontFamily:"'IBM Plex Mono',monospace",fontWeight:500}}>
                {i+1}. {s.state_name} <span style={{color:"rgba(180,210,255,0.4)",fontSize:10}}>({s.state_code})</span>
              </span>
              <span style={{fontSize:13,color:col,fontFamily:"'IBM Plex Mono',monospace",fontWeight:700}}>{v.toFixed(1)}</span>
            </div>
            <div style={{height:5,background:"rgba(255,255,255,0.05)",borderRadius:3}}>
              <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${col}aa,${col})`,borderRadius:3,boxShadow:`0 0 6px ${col}55`,transition:"width 0.6s ease"}} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Alert Row ────────────────────────────────────────────────────────────────
function AlertRow({ alert, onAck, onSelect, selected }: {
  alert:Alert; onAck:(id:string)=>void; onSelect:(a:Alert)=>void; selected:boolean;
}) {
  const {color,bg}=SEV[alert.type];
  const age=Math.floor((Date.now()-alert.timestamp.getTime())/60000);
  const ageStr=age<60?`${age}m`:`${Math.floor(age/60)}h ${age%60}m`;
  return (
    <div onClick={()=>onSelect(alert)} style={{
      display:"grid", gridTemplateColumns:"16px 80px 120px 1fr 70px 80px 80px",
      alignItems:"center", gap:12, padding:"13px 20px",
      background:selected?"rgba(0,212,255,0.06)":alert.acknowledged?"rgba(255,255,255,0.005)":bg,
      borderLeft:`3px solid ${selected?"#00d4ff":alert.acknowledged?"transparent":color}`,
      borderBottom:"1px solid rgba(255,255,255,0.04)",
      cursor:"pointer", opacity:alert.acknowledged?0.38:1,
      transition:"background 0.15s, opacity 0.2s",
    }}>
      <Pulse type={alert.type} />
      <span style={{
        fontSize:10,fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,
        color,letterSpacing:"0.07em",padding:"3px 7px",borderRadius:4,
        background:bg,border:`1px solid ${color}55`,whiteSpace:"nowrap",
        boxShadow:`0 0 8px ${color}22`,
      }}>{alert.type}</span>
      <div>
        <div style={{fontSize:12,color:"rgba(200,225,255,0.9)",fontFamily:"'IBM Plex Mono',monospace",fontWeight:600}}>{alert.state_code}</div>
        <div style={{fontSize:10,color:"rgba(180,210,255,0.5)",fontFamily:"'IBM Plex Mono',monospace",marginTop:1}}>{alert.dimension}</div>
      </div>
      <span style={{fontSize:12,color:"rgba(210,230,255,0.75)",fontFamily:"'IBM Plex Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:1.3}}>
        {alert.message}
      </span>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:15,color,fontFamily:"'IBM Plex Mono',monospace",fontWeight:700}}>{alert.score.toFixed(1)}</div>
        <div style={{fontSize:9,color:"rgba(180,210,255,0.3)",fontFamily:"'IBM Plex Mono',monospace"}}>/100</div>
      </div>
      <span style={{fontSize:11,color:"rgba(180,210,255,0.4)",fontFamily:"'IBM Plex Mono',monospace",textAlign:"right",whiteSpace:"nowrap"}}>{ageStr}</span>
      <button onClick={e=>{e.stopPropagation();onAck(alert.id);}} style={{
        fontSize:10,fontFamily:"'IBM Plex Mono',monospace",padding:"4px 10px",borderRadius:4,cursor:"pointer",
        background:"transparent",
        border:`1px solid ${alert.acknowledged?"rgba(255,255,255,0.08)":"rgba(0,212,255,0.3)"}`,
        color:alert.acknowledged?"rgba(180,210,255,0.2)":"rgba(0,212,255,0.65)",
        letterSpacing:"0.05em",whiteSpace:"nowrap",
      }}>{alert.acknowledged?"ACK'd":"ACK"}</button>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AlertsDashboard() {
  const [states,   setStates]   = useState<StateData[]>([]);
  const [national, setNational] = useState<NationalStats|null>(null);
  const [alerts,   setAlerts]   = useState<Alert[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string|null>(null);
  const [selected, setSelected] = useState<Alert|null>(null);
  const [filter,   setFilter]   = useState<"ALL"|Alert["type"]>("ALL");
  const [search,   setSearch]   = useState("");
  const [lastSync, setLastSync] = useState(new Date());
  const [syncing,  setSyncing]  = useState(false);

  const load = useCallback(async () => {
    setSyncing(true);
    try {
      const [r1,r2]=await Promise.all([fetch(`${API_URL}/api/etats`),fetch(`${API_URL}/api/stats/national`)]);
      if(!r1.ok||!r2.ok) throw new Error(`API ${r1.status}/${r2.status}`);
      const [sd,nd]:[StateData[],NationalStats]=await Promise.all([r1.json(),r2.json()]);
      setStates(sd); setNational(nd); setAlerts(generateAlerts(sd)); setLastSync(new Date()); setError(null);
    } catch(e:unknown){ setError(e instanceof Error?e.message:"Connection failed"); }
    finally{ setLoading(false); setSyncing(false); }
  },[]);

  useEffect(()=>{ load(); const iv=setInterval(load,30_000); return()=>clearInterval(iv); },[load]);

  const filtered=alerts
    .filter(a=>filter==="ALL"||a.type===filter)
    .filter(a=>!search||a.state_name.toLowerCase().includes(search.toLowerCase())||a.state_code.toLowerCase().includes(search.toLowerCase())||a.dimension.toLowerCase().includes(search.toLowerCase()));

  const counts={
    CRITICAL:alerts.filter(a=>a.type==="CRITICAL"&&!a.acknowledged).length,
    WARNING: alerts.filter(a=>a.type==="WARNING" &&!a.acknowledged).length,
    WATCH:   alerts.filter(a=>a.type==="WATCH"   &&!a.acknowledged).length,
    INFO:    alerts.filter(a=>a.type==="INFO"     &&!a.acknowledged).length,
  };

  const ack   =(id:string)=>setAlerts(p=>p.map(a=>a.id===id?{...a,acknowledged:true}:a));
  const ackAll=()=>setAlerts(p=>p.map(a=>(filter==="ALL"||a.type===filter)?{...a,acknowledged:true}:a));
  const selectedState=selected?states.find(s=>s.state_code===selected.state_code)??null:null;

  const card=(title:string,child:React.ReactNode,accent="#00d4ff")=>(
    <div style={{background:"rgba(255,255,255,0.018)",border:"1px solid rgba(255,255,255,0.06)",borderTop:`2px solid ${accent}66`,borderRadius:10,padding:"16px 18px"}}>
      <div style={{fontSize:10,color:`${accent}99`,letterSpacing:"0.18em",marginBottom:14,fontFamily:"'IBM Plex Mono',monospace",fontWeight:500}}>{title}</div>
      {child}
    </div>
  );

  if(loading) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#040d1a",fontFamily:"'IBM Plex Mono',monospace"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{textAlign:"center"}}>
        <div style={{width:48,height:48,border:"2px solid #00d4ff",borderTopColor:"transparent",borderRadius:"50%",margin:"0 auto 16px",animation:"spin 0.7s linear infinite"}} />
        <div style={{color:"#00d4ff",fontSize:12,letterSpacing:"0.2em"}}>INITIALIZING ALERT FEED…</div>
      </div>
    </div>
  );

  if(error) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#040d1a",fontFamily:"'IBM Plex Mono',monospace"}}>
      <div style={{textAlign:"center",padding:36,border:"1px solid rgba(255,59,92,0.3)",borderRadius:10}}>
        <div style={{color:"#ff3b5c",fontSize:14,marginBottom:12,letterSpacing:"0.1em"}}>CONNECTION FAILURE</div>
        <div style={{color:"rgba(180,210,255,0.5)",fontSize:12,marginBottom:24}}>{error}</div>
        <button onClick={load} style={{background:"transparent",border:"1px solid #00d4ff",color:"#00d4ff",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,padding:"8px 20px",borderRadius:5,cursor:"pointer",letterSpacing:"0.1em"}}>RETRY</button>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{background:#040d1a;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#030b16;}
        ::-webkit-scrollbar-thumb{background:rgba(0,212,255,0.2);border-radius:2px;}
        @keyframes pulseRing{0%{transform:scale(.8);opacity:.6}100%{transform:scale(2.6);opacity:0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes scanH{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
      `}</style>

      <div style={{
        minHeight:"100vh",
        background:"#040d1a",
        backgroundImage:`
          radial-gradient(ellipse 100% 45% at 50% 0%,rgba(0,40,72,0.55) 0%,transparent 60%),
          linear-gradient(180deg,rgba(0,212,255,0.013) 0px,transparent 1px),
          linear-gradient(90deg,rgba(0,212,255,0.013) 0px,transparent 1px)
        `,
        backgroundSize:"100% 100%,48px 48px,48px 48px",
        fontFamily:"'IBM Plex Mono',monospace",
        color:"#c8dcff",
        paddingBottom:56,
      }}>

        {/* ── KPI STRIP ── */}
        <div style={{padding:"20px 28px 0"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:20}}>
            {[
              {label:"NATIONAL AVG",    value:Number(national?.avg_score??0).toFixed(1), unit:"/100", col:(national?.avg_score??0)<50?"#ff3b5c":"#00ff9d"},
              {label:"ACTIVE ALERTS",   value:String(alerts.filter(a=>!a.acknowledged).length), unit:" open", col:"#ffaa00"},
              {label:"CRITICAL STATES", value:String(national?.critical_count??0), unit:" states", col:"#ff3b5c"},
              {label:"SCORE RANGE",     value:Number(national?.dispersion??0).toFixed(1), unit:" pts", col:"#00d4ff"},
              {label:"TOP STATE",       value:national?.top_state_code??"—", unit:` · ${Number(national?.max_score??0).toFixed(0)}`, col:"#00ff9d"},
            ].map((k,i)=>(
              <div key={i} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderTop:`2px solid ${k.col}55`,borderRadius:9,padding:"14px 16px",animation:`fadeIn 0.35s ${i*0.07}s both`}}>
                <div style={{fontSize:9,color:"rgba(180,210,255,0.35)",letterSpacing:"0.18em",marginBottom:8}}>{k.label}</div>
                <div style={{fontSize:24,fontWeight:700,color:k.col,lineHeight:1}}>
                  {k.value}<span style={{fontSize:11,color:"rgba(180,210,255,0.35)",fontWeight:400}}>{k.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── MAIN GRID ── */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 360px",gap:16,alignItems:"start"}}>

            {/* LEFT ─ Feed */}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>

              {/* Controls */}
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",padding:"12px 16px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:9}}>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search state · dimension…" style={{
                  flex:1,minWidth:180,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(0,212,255,0.15)",borderRadius:5,
                  padding:"7px 12px",color:"#c8dcff",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,outline:"none",
                }} />
                {(["ALL","CRITICAL","WARNING","WATCH","INFO"] as const).map(f=>{
                  const active=filter===f;
                  const col=f==="ALL"?"#00d4ff":SEV[f].color;
                  const cnt=f!=="ALL"?counts[f]:0;
                  return(
                    <button key={f} onClick={()=>setFilter(f)} style={{
                      background:active?`${col}1a`:"transparent",
                      border:`1px solid ${active?col:"rgba(255,255,255,0.1)"}`,
                      color:active?col:"rgba(180,210,255,0.4)",
                      fontFamily:"'IBM Plex Mono',monospace",fontSize:10,
                      padding:"5px 12px",borderRadius:4,cursor:"pointer",letterSpacing:"0.07em",whiteSpace:"nowrap",
                      boxShadow:active?`0 0 10px ${col}22`:"none",
                    }}>{f}{cnt>0?` (${cnt})`:""}</button>
                  );
                })}
                <button onClick={ackAll} style={{marginLeft:"auto",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(180,210,255,0.3)",fontFamily:"'IBM Plex Mono',monospace",fontSize:10,padding:"5px 12px",borderRadius:4,cursor:"pointer",letterSpacing:"0.07em"}}>ACK ALL</button>
              </div>

              {/* Column headers */}
              <div style={{display:"grid",gridTemplateColumns:"16px 80px 120px 1fr 70px 80px 80px",gap:12,padding:"5px 20px",fontSize:10,color:"rgba(180,210,255,0.25)",letterSpacing:"0.13em"}}>
                <span/><span>TYPE</span><span>STATE · DIM</span><span>MESSAGE</span>
                <span style={{textAlign:"right"}}>SCORE</span><span style={{textAlign:"right"}}>AGE</span><span/>
              </div>

              {/* Alert list */}
              <div style={{background:"rgba(255,255,255,0.012)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:9,overflow:"hidden",maxHeight:"calc(100vh - 280px)",overflowY:"auto"}}>
                {filtered.length===0?(
                  <div style={{padding:48,textAlign:"center",color:"rgba(180,210,255,0.25)",fontSize:12,letterSpacing:"0.1em"}}>NO ALERTS MATCH CURRENT FILTER</div>
                ):filtered.map(a=>(
                  <AlertRow key={a.id} alert={a} onAck={ack} onSelect={setSelected} selected={selected?.id===a.id} />
                ))}
              </div>
              <div style={{fontSize:10,color:"rgba(180,210,255,0.2)",textAlign:"right",letterSpacing:"0.1em"}}>
                {filtered.length} alerts · {alerts.filter(a=>a.acknowledged).length} acknowledged
              </div>
            </div>

            {/* RIGHT ─ Panels */}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>

              {national&&card("SCORE DISTRIBUTION · ALL STATES",<ScoreSparkline states={states} national={national} />)}
              {card("ALERT VOLUME · LAST 6H",<AlertTimeline alerts={alerts} />)}

              {/* Severity breakdown */}
              {card("SEVERITY BREAKDOWN",(
                <div>
                  {(["CRITICAL","WARNING","WATCH","INFO"] as const).map(t=>{
                    const total=alerts.filter(a=>a.type===t).length;
                    const pct=alerts.length?(total/alerts.length)*100:0;
                    return(
                      <div key={t} style={{marginBottom:12}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                          <span style={{fontSize:12,color:SEV[t].color,letterSpacing:"0.08em",fontWeight:600}}>{t}</span>
                          <span style={{fontSize:12,color:"rgba(180,210,255,0.5)",fontFamily:"'IBM Plex Mono',monospace",fontWeight:600}}>{total}</span>
                        </div>
                        <div style={{height:5,background:"rgba(255,255,255,0.05)",borderRadius:3}}>
                          <div style={{height:"100%",width:`${pct}%`,borderRadius:3,background:SEV[t].color,boxShadow:`0 0 6px ${SEV[t].glow}`,transition:"width 0.6s ease"}} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Top declining states */}
              {card("TOP DECLINING STATES",<TopDeclining states={states} />,"#ff3b5c")}

              {/* Dimension heatmap */}
              {card("DIMENSION HEATMAP · TOP STATES",<DimHeatmap states={[...states].sort((a,b)=>Number(b.composite_score)-Number(a.composite_score))} />,"#ffaa00")}

              {/* State detail */}
              {selected&&selectedState?(
                <div style={{background:"rgba(255,255,255,0.018)",border:`1px solid ${SEV[selected.type].color}30`,borderRadius:10,padding:"16px 18px",animation:"fadeIn 0.2s ease both"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <span style={{fontSize:10,color:SEV[selected.type].color,letterSpacing:"0.15em",fontWeight:600}}>STATE DETAIL · {selected.state_code}</span>
                    <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",color:"rgba(180,210,255,0.4)",cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
                  </div>
                  <div style={{fontSize:12,color:"rgba(210,230,255,0.8)",fontFamily:"'IBM Plex Mono',monospace",marginBottom:14,lineHeight:1.6,padding:"10px 12px",background:SEV[selected.type].bg,border:`1px solid ${SEV[selected.type].color}25`,borderRadius:6}}>
                    {selected.message}
                  </div>
                  <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
                    <RadarChart state={selectedState} />
                  </div>
                  <div style={{display:"flex",justifyContent:"space-around",marginBottom:14}}>
                    <Gauge value={Number(selectedState.composite_score)} label="Overall" size={88} />
                    <Gauge value={Number(selectedState.access_score)}    label="Access"  size={88} />
                    <Gauge value={Number(selectedState.income_score)}    label="Income"  size={88} />
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                    {[
                      ["Population",`${(selectedState.population_2020/1e6).toFixed(2)}M`],
                      ["Region",selectedState.region],
                      ["Division",selectedState.division],
                      ["Δ Threshold",`${(selected.score-selected.threshold).toFixed(1)} pts`],
                      ["Transit",`${Number(selectedState.transit_score).toFixed(1)}/100`],
                      ["CPI Index",`${Number(selectedState.xpi_score).toFixed(1)}/100`],
                    ].map(([k,v])=>(
                      <div key={k} style={{padding:"7px 10px",background:"rgba(255,255,255,0.025)",borderRadius:6}}>
                        <div style={{fontSize:9,color:"rgba(180,210,255,0.3)",letterSpacing:"0.12em",marginBottom:2}}>{k}</div>
                        <div style={{fontSize:13,color:"#c8dcff",fontWeight:500}}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ):(
                <div style={{padding:24,textAlign:"center",background:"rgba(255,255,255,0.01)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:10,color:"rgba(180,210,255,0.18)",fontSize:11,letterSpacing:"0.1em",lineHeight:2}}>
                  SELECT AN ALERT<br/>TO VIEW STATE DETAIL
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}