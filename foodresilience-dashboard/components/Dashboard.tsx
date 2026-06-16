"use client";

import { useState } from "react";
import Topbar from "./Topbar";
import WorldMap from "./WorldMap";
import { KpiGrid } from "./MetricCard";
import AlertFeed from "./AlertFeed";

const panel: React.CSSProperties = {
  background: "#060e1c",
  border: "1px solid #0d3a5c",
  position: "relative",
  overflow: "hidden",
  borderRadius: 8,
};

const panelTitle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 2,
  color: "#4a9aba",
  padding: "7px 12px",
  borderBottom: "1px solid #0d2a40",
  background: "#050c18",
};

export default function Dashboard() {
  const [tab, setTab] = useState("OVERVIEW");

  return (
    <div style={{ minHeight: "100vh", background: "#050b18" }}>
      {/* <Topbar /> */}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8 }}>

        {/* ── KPI Cards ── */}
        <KpiGrid />

        {/* ── Map + Alerts ── */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
          <div style={{ ...panel, minHeight: 300, display: "flex", flexDirection: "column" }}>
            <div style={panelTitle}>WORLD RESILIENCE MAP</div>
            <div style={{ flex: 1 }}>
              <WorldMap />
            </div>
          </div>

          <div style={{ ...panel, minHeight: 300 }}>
            <div style={panelTitle}>AI ALERT FEED</div>
            <div style={{ padding: 10 }}>
              <AlertFeed />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}