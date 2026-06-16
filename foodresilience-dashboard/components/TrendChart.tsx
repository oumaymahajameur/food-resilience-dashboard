// components/TrendChart.tsx
"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import {tendance} from "../../data/ fakeData";

const SERIES = [
  { key: "cpi",       label: "CPI",          color: "#2ecc71" },
  { key: "acces",     label: "Accessibilité", color: "#4a9eff" },
  { key: "transport", label: "Transport",     color: "#f39c12" },
  { key: "economie",  label: "Économie",      color: "#a78bfa" },
];

export default function TrendChart() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const W = svgRef.current.clientWidth || 700;
    const H = 240;
    const m = { top: 16, right: 16, bottom: 30, left: 40 };
    const iW = W - m.left - m.right;
    const iH = H - m.top - m.bottom;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("height", H)
      .append("g")
      .attr("transform", `translate(${m.left},${m.top})`);

    const x = d3.scalePoint().domain(tendance.map(d => d.annee)).range([0, iW]);
    const y = d3.scaleLinear().domain([30, 90]).range([iH, 0]);

    // Grille horizontale
    svg.selectAll(".grid-line")
      .data(y.ticks(5))
      .join("line")
      .attr("x1", 0).attr("x2", iW)
      .attr("y1", d => y(d)).attr("y2", d => y(d))
      .attr("stroke", "#1e2440").attr("stroke-width", 1);

    // Axes
    svg.append("g")
      .attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call(g => g.select(".domain").attr("stroke", "#2a3050"))
      .selectAll("text")
      .style("fill", "#4a5275").style("font-size", "11px").attr("dy", "1.2em");

    svg.append("g")
      .call(d3.axisLeft(y).ticks(5).tickSize(0))
      .call(g => g.select(".domain").remove())
      .selectAll("text")
      .style("fill", "#4a5275").style("font-size", "11px").attr("dx", "-0.5em");

    // Lignes + points
    SERIES.forEach(({ key, color }) => {
      const line = d3.line<typeof tendance[0]>()
        .x(d => x(d.annee)!)
        .y(d => y(d[key as keyof typeof tendance[0]] as number))
        .curve(d3.curveMonotoneX);

      svg.append("path")
        .datum(tendance)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("d", line);

      svg.selectAll(`.dot-${key}`)
        .data(tendance)
        .join("circle")
        .attr("cx", d => x(d.annee)!)
        .attr("cy", d => y(d[key as keyof typeof tendance[0]] as number))
        .attr("r", 3).attr("fill", color);
    });
  }, []);

  return (
    <div>
      <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
        {SERIES.map(s => (
          <span key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#4a5275" }}>
            <span style={{ width: 20, height: 2, background: s.color, display: "inline-block", borderRadius: 1 }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg ref={svgRef} style={{ width: "100%", display: "block" }} />
    </div>
  );
}