"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { StateData, useDashboardData } from "@/hooks/StatesData";

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  state: StateData | null;
}

function getRiskColor(score: number): string {
  if (score >= 75) return "#00f5d4";
  if (score >= 60) return "#00b4d8";
  if (score >= 45) return "#f77f00";
  return "#ef233c";
}
function getRiskGlow(score: number): string {
  if (score >= 75) return "rgba(0,245,212,0.6)";
  if (score >= 60) return "rgba(0,180,216,0.5)";
  if (score >= 45) return "rgba(247,127,0,0.6)";
  return "rgba(239,35,60,0.7)";
}
function getRiskLabel(score: number): string {
  if (score >= 75) return "LOW RISK";
  if (score >= 60) return "MEDIUM RISK";
  if (score >= 45) return "HIGH RISK";
  return "CRITICAL";
}

const FIPS_TO_CODE: Record<string, string> = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT",
  "10":"DE","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN",
  "19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA",
  "26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV",
  "33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH",
  "40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN",
  "48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY",
};

export default function Map() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const usDataRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, state: null });
  const [selectedState, setSelectedState] = useState<StateData | null>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [scanAngle, setScanAngle] = useState(0);
  const animFrameRef = useRef<number | null>(null);

  const { states, national, loading, error, refetch } = useDashboardData();
  const stateMap = Object.fromEntries(states.map((s: StateData) => [s.state_code.toUpperCase(), s]));

  const avgScore = national ? Math.round(Number(national.avg_score)) : 0;
  const worstState = states.reduce((prev: StateData | null, curr: StateData) =>
    !prev || Number(curr.composite_score) < Number(prev.composite_score) ? curr : prev, null);
  const bestState = states.reduce((prev: StateData | null, curr: StateData) =>
    !prev || Number(curr.composite_score) > Number(prev.composite_score) ? curr : prev, null);

  useEffect(() => {
    let angle = 0;
    const animate = () => {
      angle = (angle + 0.4) % 360;
      setScanAngle(angle);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  useEffect(() => {
    if (loading || !states.length) return;
    const container = containerRef.current;
    if (!container) return;

    function getUsData(): Promise<any> {
      if (usDataRef.current) return Promise.resolve(usDataRef.current);
      return fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
        .then((r) => r.json())
        .then((us) => {
          usDataRef.current = us;
          return us;
        });
    }

    function draw() {
      const svg = d3.select(svgRef.current);
      const width = container!.clientWidth || 700;
      const height = container!.clientHeight || 500;

      svg.attr("width", width).attr("height", height).style("background", "transparent");
      svg.selectAll("*").remove();

      const defs = svg.append("defs");

      const glowFilter = defs.append("filter").attr("id", "glow").attr("x", "-30%").attr("y", "-30%").attr("width", "160%").attr("height", "160%");
      glowFilter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "coloredBlur");
      const feMerge = glowFilter.append("feMerge");
      feMerge.append("feMergeNode").attr("in", "coloredBlur");
      feMerge.append("feMergeNode").attr("in", "SourceGraphic");

      const strongGlow = defs.append("filter").attr("id", "strongGlow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
      strongGlow.append("feGaussianBlur").attr("stdDeviation", "8").attr("result", "coloredBlur");
      const sm2 = strongGlow.append("feMerge");
      sm2.append("feMergeNode").attr("in", "coloredBlur");
      sm2.append("feMergeNode").attr("in", "SourceGraphic");

      const radialGrad = defs.append("radialGradient").attr("id", "globeBg").attr("cx", "50%").attr("cy", "45%").attr("r", "55%");
      radialGrad.append("stop").attr("offset", "0%").attr("stop-color", "#0d2137").attr("stop-opacity", "0.9");
      radialGrad.append("stop").attr("offset", "60%").attr("stop-color", "#061523").attr("stop-opacity", "0.95");
      radialGrad.append("stop").attr("offset", "100%").attr("stop-color", "#020d18").attr("stop-opacity", "1");

      const rimGrad = defs.append("radialGradient").attr("id", "rimGrad").attr("cx", "50%").attr("cy", "50%").attr("r", "50%");
      rimGrad.append("stop").attr("offset", "75%").attr("stop-color", "transparent");
      rimGrad.append("stop").attr("offset", "88%").attr("stop-color", "#00b4d8").attr("stop-opacity", "0.08");
      rimGrad.append("stop").attr("offset", "93%").attr("stop-color", "#00f5d4").attr("stop-opacity", "0.35");
      rimGrad.append("stop").attr("offset", "96%").attr("stop-color", "#00f5d4").attr("stop-opacity", "0.6");
      rimGrad.append("stop").attr("offset", "100%").attr("stop-color", "#00b4d8").attr("stop-opacity", "0.15");

      const clipRadius = Math.min(width, height) * 0.46;
      const cx = width / 2;
      const cy = height / 2 + 6;

      defs.append("clipPath").attr("id", "globeClip")
        .append("circle").attr("cx", cx).attr("cy", cy).attr("r", clipRadius);

      const globeGroup = svg.append("g").attr("class", "globe");
      globeGroup.append("circle").attr("cx", cx).attr("cy", cy).attr("r", clipRadius).attr("fill", "url(#globeBg)");

      const gridGroup = globeGroup.append("g").attr("clip-path", "url(#globeClip)").attr("opacity", 0.08);
      for (let i = 1; i < 8; i++) {
        gridGroup.append("line")
          .attr("x1", cx - clipRadius).attr("y1", cy - clipRadius + (i * clipRadius * 2) / 8)
          .attr("x2", cx + clipRadius).attr("y2", cy - clipRadius + (i * clipRadius * 2) / 8)
          .attr("stroke", "#00f5d4").attr("stroke-width", 0.5);
        gridGroup.append("line")
          .attr("x1", cx - clipRadius + (i * clipRadius * 2) / 8).attr("y1", cy - clipRadius)
          .attr("x2", cx - clipRadius + (i * clipRadius * 2) / 8).attr("y2", cy + clipRadius)
          .attr("stroke", "#00f5d4").attr("stroke-width", 0.5);
      }

      const mapGroup = globeGroup.append("g").attr("clip-path", "url(#globeClip)").attr("class", "states-group");
      const projection = d3.geoAlbersUsa().scale(clipRadius * 1.85).translate([cx, cy + 5]);
      const path = d3.geoPath().projection(projection);

      getUsData()
        .then((us: any) => {
          const statesFeature = topojson.feature(us, us.objects.states) as any;
          mapGroup.selectAll<SVGPathElement, any>(".state")
            .data(statesFeature.features)
            .enter().append("path").attr("class", "state")
            .attr("d", path as any)
            .attr("fill", (d: any) => {
              const fips = d.id.toString().padStart(2, "0");
              const code = FIPS_TO_CODE[fips];
              const stateData = code ? stateMap[code] : null;
              return stateData ? getRiskColor(Number(stateData.composite_score)) : "#0a2a3a";
            })
            .attr("fill-opacity", 0.72).attr("stroke", "#00f5d4")
            .attr("stroke-width", 0.6).attr("stroke-opacity", 0.5)
            .attr("filter", "url(#glow)").style("cursor", "pointer").style("transition", "fill-opacity 0.2s")
            .on("mousemove", function (event: MouseEvent, d: any) {
              const fips = d.id.toString().padStart(2, "0");
              const code = FIPS_TO_CODE[fips];
              const stateData = code ? stateMap[code] : null;
              if (!stateData) return;
              d3.select(this).attr("fill-opacity", 1).attr("filter", "url(#strongGlow)");
              const rect = container!.getBoundingClientRect();
              setTooltip({ visible: true, x: event.clientX - rect.left, y: event.clientY - rect.top, state: stateData });
            })
            .on("mouseleave", function () {
              d3.select(this).attr("fill-opacity", 0.72).attr("filter", "url(#glow)");
              setTooltip((t) => ({ ...t, visible: false }));
            })
            .on("click", (_: any, d: any) => {
              const fips = d.id.toString().padStart(2, "0");
              const code = FIPS_TO_CODE[fips];
              const stateData = code ? stateMap[code] : null;
              if (stateData) setSelectedState(stateData);
            });

          mapGroup.append("path")
            .datum(topojson.mesh(us, us.objects.states, (a: any, b: any) => a !== b))
            .attr("fill", "none").attr("stroke", "#00f5d4")
            .attr("stroke-width", 0.4).attr("stroke-opacity", 0.3).attr("d", path as any);

          setIsRendered(true);
        })
        .catch(() => setIsRendered(true));

      globeGroup.append("circle").attr("cx", cx).attr("cy", cy).attr("r", clipRadius)
        .attr("fill", "url(#rimGrad)").attr("pointer-events", "none");

      [1.07, 1.13, 1.20].forEach((r, i) => {
        globeGroup.append("circle").attr("cx", cx).attr("cy", cy).attr("r", clipRadius * r)
          .attr("fill", "none").attr("stroke", "#00f5d4")
          .attr("stroke-width", i === 0 ? 1.5 : i === 1 ? 0.8 : 0.4)
          .attr("stroke-opacity", i === 0 ? 0.7 : i === 1 ? 0.3 : 0.15)
          .attr("stroke-dasharray", i === 1 ? "4 6" : i === 2 ? "2 8" : "none")
          .attr("filter", i === 0 ? "url(#glow)" : "none");
      });

      const tickCount = 72;
      for (let i = 0; i < tickCount; i++) {
        const angle = (i / tickCount) * 2 * Math.PI;
        const r1 = clipRadius * 1.07;
        const r2 = clipRadius * (i % 6 === 0 ? 1.115 : 1.09);
        globeGroup.append("line")
          .attr("x1", cx + r1 * Math.cos(angle)).attr("y1", cy + r1 * Math.sin(angle))
          .attr("x2", cx + r2 * Math.cos(angle)).attr("y2", cy + r2 * Math.sin(angle))
          .attr("stroke", "#00f5d4")
          .attr("stroke-width", i % 6 === 0 ? 1 : 0.5)
          .attr("stroke-opacity", i % 6 === 0 ? 0.8 : 0.3);
      }

      const cornerSize = 18;
      [[20, 20, 1, 1],[width - 20, 20, -1, 1],[20, height - 20, 1, -1],[width - 20, height - 20, -1, -1]].forEach(([x, y, sx, sy]) => {
        svg.append("path")
          .attr("d", `M ${x} ${y + sy * cornerSize} L ${x} ${y} L ${x + sx * cornerSize} ${y}`)
          .attr("fill", "none").attr("stroke", "#00f5d4")
          .attr("stroke-width", 1.5).attr("stroke-opacity", 0.6);
      });
    }

    draw();

    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(draw, 150);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimer);
    };
  }, [states, loading]);

  const scanRad = scanAngle * (Math.PI / 180);
  const isLoading = loading || !isRendered;

  return (
    <div className="nrg-root" style={{
      position: "relative", width: "100%", height: "100%", minHeight: 520,
      background: "linear-gradient(135deg, #020d18 0%, #040f1e 50%, #020c16 100%)",
      fontFamily: "'Rajdhani', 'Share Tech Mono', monospace",
      overflow: "hidden", borderRadius: 12, border: "1px solid rgba(0,245,212,0.15)",
    }}>

      {/* Background particles */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {[...Array(24)].map((_, i) => (
          <div key={i} style={{
            position: "absolute", width: i % 3 === 0 ? 2 : 1, height: i % 3 === 0 ? 2 : 1,
            borderRadius: "50%", background: i % 4 === 0 ? "#00f5d4" : "#00b4d8",
            left: `${(i * 4.3 + 2) % 100}%`, top: `${(i * 7.1 + 5) % 100}%`,
            opacity: 0.3 + (i % 3) * 0.15,
            animation: `pulse ${2 + (i % 3)}s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </div>

      {/* ── MOST AT RISK / MOST RESILIENT — LEFT, large & visible ── */}
      {!loading && worstState && bestState && (
        <div className="nrg-left-panel" style={{
          position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)",
          zIndex: 10, display: "flex", flexDirection: "column", gap: 14,
        }}>
          {/* Most At Risk */}
          <div className="nrg-stat-box nrg-stat-box-bad" style={{
            background: "rgba(239,35,60,0.08)",
            border: "1px solid rgba(239,35,60,0.4)",
            borderLeft: "3px solid #ef233c",
            borderRadius: 6, padding: "14px 18px", minWidth: 130,
            backdropFilter: "blur(8px)",
            boxShadow: "0 0 20px rgba(239,35,60,0.15)",
          }}>
            <div style={{ color: "rgba(239,35,60,0.6)", fontSize: 8, letterSpacing: 3, fontFamily: "monospace", marginBottom: 6 }}>
              MOST AT RISK
            </div>
            <div className="nrg-stat-value" style={{ color: "#ef233c", fontSize: 32, fontWeight: 700, letterSpacing: 2, lineHeight: 1, textShadow: "0 0 16px rgba(239,35,60,0.8)", fontFamily: "monospace" }}>
              {worstState.state_code}
            </div>
            <div className="nrg-stat-score" style={{ color: "rgba(239,35,60,0.7)", fontSize: 18, fontWeight: 600, marginTop: 4, fontFamily: "monospace" }}>
              {Number(worstState.composite_score).toFixed(1)}
            </div>
            <div style={{ marginTop: 8, height: 2, background: "rgba(239,35,60,0.15)", borderRadius: 1 }}>
              <div style={{ height: "100%", width: `${Number(worstState.composite_score)}%`, background: "#ef233c", borderRadius: 1, boxShadow: "0 0 6px #ef233c" }} />
            </div>
          </div>

          {/* Divider */}
          <div className="nrg-divider" style={{ height: 1, background: "rgba(0,245,212,0.1)", margin: "0 8px" }} />

          {/* Most Resilient */}
          <div className="nrg-stat-box nrg-stat-box-good" style={{
            background: "rgba(0,245,212,0.05)",
            border: "1px solid rgba(0,245,212,0.3)",
            borderLeft: "3px solid #00f5d4",
            borderRadius: 6, padding: "14px 18px", minWidth: 130,
            backdropFilter: "blur(8px)",
            boxShadow: "0 0 20px rgba(0,245,212,0.1)",
          }}>
            <div style={{ color: "rgba(0,245,212,0.5)", fontSize: 8, letterSpacing: 3, fontFamily: "monospace", marginBottom: 6 }}>
              MOST RESILIENT
            </div>
            <div className="nrg-stat-value" style={{ color: "#00f5d4", fontSize: 32, fontWeight: 700, letterSpacing: 2, lineHeight: 1, textShadow: "0 0 16px rgba(0,245,212,0.8)", fontFamily: "monospace" }}>
              {bestState.state_code}
            </div>
            <div className="nrg-stat-score" style={{ color: "rgba(0,245,212,0.7)", fontSize: 18, fontWeight: 600, marginTop: 4, fontFamily: "monospace" }}>
              {Number(bestState.composite_score).toFixed(1)}
            </div>
            <div style={{ marginTop: 8, height: 2, background: "rgba(0,245,212,0.1)", borderRadius: 1 }}>
              <div style={{ height: "100%", width: `${Number(bestState.composite_score)}%`, background: "#00f5d4", borderRadius: 1, boxShadow: "0 0 6px #00f5d4" }} />
            </div>
          </div>
        </div>
      )}

      {/* ── RISK LEVELS — top right ── */}
      <div className="nrg-legend-panel" style={{
        position: "absolute", top: 16, right: 16, zIndex: 10,
        background: "rgba(0,20,40,0.85)", border: "1px solid rgba(0,245,212,0.2)",
        borderRadius: 6, padding: "10px 14px", backdropFilter: "blur(8px)",
      }}>
        <div style={{ color: "rgba(0,245,212,0.45)", fontSize: 8, letterSpacing: 3, marginBottom: 8, fontFamily: "monospace" }}>
          RISK LEVELS
        </div>
        {[
          { label: "LOW RISK",  range: "75–100", color: "#00f5d4" },
          { label: "MEDIUM",    range: "60–74",  color: "#00b4d8" },
          { label: "HIGH RISK", range: "45–59",  color: "#f77f00" },
          { label: "CRITICAL",  range: "0–44",   color: "#ef233c" },
        ].map((item) => (
          <div key={item.label} className="nrg-legend-row" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color, boxShadow: `0 0 6px ${item.color}`, flexShrink: 0 }} />
            <div>
              <div style={{ color: item.color, fontSize: 9, fontWeight: 700, letterSpacing: 1, fontFamily: "monospace" }}>{item.label}</div>
              <div className="nrg-legend-range" style={{ color: "rgba(255,255,255,0.25)", fontSize: 8, fontFamily: "monospace" }}>{item.range}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Title — top left, no logo ── */}
      <div className="nrg-title-panel" style={{ position: "absolute", top: 16, left: 18, zIndex: 10 }}>
        <div className="nrg-title-eyebrow" style={{ color: "rgba(0,245,212,0.45)", fontSize: 8, letterSpacing: 3, fontFamily: "monospace" }}>
          GEOSPATIAL · RISK INTELLIGENCE
        </div>
        <div className="nrg-title-main" style={{ color: "#00f5d4", fontSize: 17, fontWeight: 700, letterSpacing: 3, textShadow: "0 0 16px rgba(0,245,212,0.7)", lineHeight: 1.2 }}>
          NATIONAL RESILIENCE GRID
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 50,
          background: "rgba(239,35,60,0.1)", border: "1px solid #ef233c44", borderRadius: 4,
          padding: "8px 14px", fontFamily: "monospace", fontSize: 10, color: "#ef233c",
          letterSpacing: 1, maxWidth: 320, textAlign: "center" }}>
          ⚠ API OFFLINE — {error}
          <button onClick={refetch} style={{ marginLeft: 8, background: "none", border: "1px solid #ef233c44", color: "#ef233c", fontSize: 9, padding: "2px 6px", cursor: "pointer", fontFamily: "monospace" }}>RETRY</button>
        </div>
      )}

      {/* SVG container — full */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }}>
        <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />

        {isRendered && (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} xmlns="http://www.w3.org/2000/svg">
              <defs><clipPath id="scanClip"><circle cx="50%" cy="50%" r="46%" /></clipPath></defs>
              <g clipPath="url(#scanClip)">
                <line x1="50%" y1="50%" x2={`${50 + 50 * Math.cos(scanRad)}%`} y2={`${50 + 50 * Math.sin(scanRad)}%`}
                  stroke="rgba(0,245,212,0.5)" strokeWidth="1" />
                <path d={`M 50% 50% L ${50 + 50 * Math.cos(scanRad)}% ${50 + 50 * Math.sin(scanRad)}% A 50% 50% 0 0 0 ${50 + 50 * Math.cos(scanRad - 0.4)}% ${50 + 50 * Math.sin(scanRad - 0.4)}% Z`}
                  fill="rgba(0,245,212,0.04)" />
              </g>
            </svg>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip.visible && tooltip.state && (
        <div className="nrg-tooltip" style={{
          position: "absolute", left: tooltip.x + 16, top: tooltip.y - 80, zIndex: 100,
          background: "rgba(2,13,24,0.95)", border: `1px solid ${getRiskColor(Number(tooltip.state.composite_score))}`,
          borderRadius: 6, padding: "10px 14px", minWidth: 200,
          boxShadow: `0 0 20px ${getRiskGlow(Number(tooltip.state.composite_score))}, 0 0 40px rgba(0,0,0,0.8)`,
          backdropFilter: "blur(12px)", pointerEvents: "none",
        }}>
          <div style={{ color: getRiskColor(Number(tooltip.state.composite_score)), fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 4, textShadow: `0 0 10px ${getRiskColor(Number(tooltip.state.composite_score))}` }}>
            {tooltip.state.state_name.toUpperCase()}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
            {[
              { label: "COMPOSITE", value: `${Number(tooltip.state.composite_score).toFixed(1)}/100` },
              { label: "RISK", value: getRiskLabel(Number(tooltip.state.composite_score)) },
              { label: "CPI SCORE", value: Number(tooltip.state.cpi_score).toFixed(1) },
              { label: "ACCESS", value: Number(tooltip.state.access_score).toFixed(1) },
              { label: "TRANSIT", value: Number(tooltip.state.transit_score).toFixed(1) },
              { label: "INCOME", value: Number(tooltip.state.income_score).toFixed(1) },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ color: "rgba(0,245,212,0.4)", fontSize: 7, letterSpacing: 2, fontFamily: "monospace" }}>{item.label}</div>
                <div style={{ color: getRiskColor(Number(tooltip.state?.composite_score)), fontSize: 11, fontWeight: 600 }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, Number(tooltip.state.composite_score))}%`, background: getRiskColor(Number(tooltip.state.composite_score)), borderRadius: 2, boxShadow: `0 0 6px ${getRiskColor(Number(tooltip.state.composite_score))}` }} />
          </div>
        </div>
      )}

      {/* Selected state panel */}
      {selectedState && (
        <div className="nrg-bottom-panel" style={{
          position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 20, background: "rgba(2,13,24,0.95)",
          border: `1px solid ${getRiskColor(Number(selectedState.composite_score))}`,
          borderRadius: 8, padding: "12px 20px",
          boxShadow: `0 0 30px ${getRiskGlow(Number(selectedState.composite_score))}`,
          backdropFilter: "blur(12px)", minWidth: 360, maxWidth: 560,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}>
          <div>
            <div style={{ color: "rgba(0,245,212,0.5)", fontSize: 8, letterSpacing: 3, fontFamily: "monospace" }}>SELECTED STATE</div>
            <div style={{ color: getRiskColor(Number(selectedState.composite_score)), fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>
              {selectedState.state_name.toUpperCase()}
            </div>
            <div style={{ color: "rgba(0,245,212,0.4)", fontSize: 9, marginTop: 2, fontFamily: "monospace" }}>{selectedState.region} · {selectedState.division}</div>
          </div>
          <div className="nrg-bottom-stats" style={{ display: "flex", gap: 16 }}>
            {[
              { label: "COMPOSITE", value: Number(selectedState.composite_score).toFixed(1) },
              { label: "CPI", value: Number(selectedState.cpi_score).toFixed(1) },
              { label: "ACCESS", value: Number(selectedState.access_score).toFixed(1) },
              { label: "TRANSIT", value: Number(selectedState.transit_score).toFixed(1) },
              { label: "INCOME", value: Number(selectedState.income_score).toFixed(1) },
            ].map((item) => (
              <div key={item.label} style={{ textAlign: "center" }}>
                <div style={{ color: "rgba(0,245,212,0.4)", fontSize: 7, letterSpacing: 2, fontFamily: "monospace" }}>{item.label}</div>
                <div style={{ color: getRiskColor(Number(selectedState.composite_score)), fontSize: 14, fontWeight: 700 }}>{item.value}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setSelectedState(null)} style={{
            background: "transparent", border: "1px solid rgba(0,245,212,0.3)", color: "#00f5d4",
            width: 24, height: 24, borderRadius: 4, cursor: "pointer", fontSize: 12,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>×</button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, background: "rgba(2,13,24,0.7)", backdropFilter: "blur(4px)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid transparent", borderTop: "2px solid #00f5d4", borderRight: "2px solid #00b4d8", animation: "spin 1s linear infinite", margin: "0 auto 12px", boxShadow: "0 0 20px rgba(0,245,212,0.4)" }} />
            <div style={{ color: "#00f5d4", fontSize: 11, letterSpacing: 3, fontFamily: "monospace" }}>
              {loading ? "FETCHING DATA FROM DATABASE..." : "RENDERING MAP..."}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&display=swap');
        @keyframes pulse { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .nrg-title-eyebrow { font-size: 7px !important; }
          .nrg-title-main { font-size: 14px !important; }
          .nrg-legend-panel { padding: 8px 10px !important; }
        }

        @media (max-width: 600px) {
          .nrg-root { min-height: 460px !important; }
          .nrg-left-panel {
            left: 50% !important;
            top: auto !important;
            bottom: 10px !important;
            transform: translateX(-50%) !important;
            flex-direction: row !important;
            gap: 10px !important;
          }
          .nrg-divider { display: none !important; }
          .nrg-stat-box { padding: 8px 12px !important; min-width: 92px !important; }
          .nrg-stat-value { font-size: 22px !important; }
          .nrg-stat-score { font-size: 13px !important; }
          .nrg-title-panel { top: 10px !important; left: 10px !important; }
          .nrg-title-main { font-size: 12px !important; letter-spacing: 1.5px !important; }
          .nrg-legend-panel { top: 10px !important; right: 10px !important; padding: 6px 8px !important; }
          .nrg-legend-range { display: none !important; }
          .nrg-bottom-panel {
            min-width: unset !important;
            width: 92vw !important;
            max-width: 92vw !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
            padding: 10px 14px !important;
          }
          .nrg-bottom-stats { overflow-x: auto !important; justify-content: flex-start !important; }
          .nrg-tooltip { max-width: 70vw !important; min-width: unset !important; }
        }

        @media (max-width: 400px) {
          .nrg-stat-box { min-width: 78px !important; padding: 6px 10px !important; }
          .nrg-stat-value { font-size: 18px !important; }
          .nrg-stat-score { font-size: 11px !important; }
        }
      `}</style>
    </div>
  );
}