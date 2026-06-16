"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

// ── Tabs avec liens ───────────────────────────────
const TABS = [
  { label: "OVERVIEW", href: "/dashboard" },
  { label: "DEEPDIVE", href: "/dashboard/DeepDive" },
  { label: "TREND", href: "/dashboard/trend" },
  { label: "WHATIF", href: "/dashboard/WhatIf" },
  { label: "Export", href: "/dashboard/export" },
  { label: "ALERTS", href: "/dashboard/alerts" },
] as const;

export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();

  // ── Live clock ────────────────────────────────
  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setDate(
        now.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).toUpperCase()
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Logout handler ────────────────────────────
  const handleLogout = () => {
    // Replace with your actual logout logic (clear session, token, etc.)
    router.push("http://localhost:3000/");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Inter:wght@400;600;800&display=swap');

        @keyframes glowLine {
          0% { background-position: 0% }
          100% { background-position: 200% }
        }

        @keyframes pulse {
          0%,100% { opacity:1; transform:scale(1) }
          50% { opacity:0.3; transform:scale(0.7) }
        }

        @keyframes clockGlow {
          0%,100% { text-shadow: 0 0 8px rgba(0,245,212,0.6); }
          50% { text-shadow: 0 0 16px rgba(0,245,212,1), 0 0 30px rgba(0,180,216,0.4); }
        }

        .tab-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 14px 16px 12px 16px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.02);
          color: #9ecfe6;
          font-weight: 700;
          font-size: 12px;
          transition: all .2s ease;
          text-decoration: none;
          white-space: nowrap;
        }

        .tab-btn:hover {
          color: #d9feff;
          border: 1px solid rgba(0,180,216,0.4);
          background: rgba(0,180,216,0.08);
        }

        .tab-btn::after {
          content: "";
          position: absolute;
          top: 0;
          left: 15%;
          width: 70%;
          height: 3px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            #00f5d4,
            #00b4d8,
            transparent
          );
          opacity: 0;
          transform: scaleX(0.4);
          transition: all .25s ease;
        }

        .tab-active::after {
          opacity: 1;
          transform: scaleX(1);
          box-shadow: 0 0 12px #00f5d4;
        }

        .tab-active {
          color: #00f5d4 !important;
          border: 1px solid rgba(0,245,212,0.4);
          background: rgba(0,245,212,0.08);
        }

        .live-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #ef233c;
          animation: pulse 1.2s infinite;
          box-shadow: 0 0 12px #ef233c;
        }

        .clock-display {
          font-family: 'Orbitron', monospace;
          font-weight: 600;
          font-size: 13px;
          color: #00f5d4;
          letter-spacing: 2px;
          animation: clockGlow 2s ease-in-out infinite;
        }

        .logout-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 10px;
          border: 1px solid rgba(239,35,60,0.35);
          background: rgba(239,35,60,0.06);
          color: #ff7b8b;
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 11px;
          letter-spacing: 1px;
          cursor: pointer;
          transition: all .2s ease;
          white-space: nowrap;
        }

        .logout-btn:hover {
          background: rgba(239,35,60,0.18);
          border-color: rgba(239,35,60,0.7);
          color: #ff4d63;
          box-shadow: 0 0 14px rgba(239,35,60,0.3);
          transform: translateY(-1px);
        }

        .logout-btn:active {
          transform: translateY(0);
        }
      `}</style>

      <nav
        style={{
          background: "linear-gradient(180deg,#09111f,#070f1c)",
          borderBottom: "1px solid rgba(0,180,216,0.2)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          fontFamily: "Inter",
        }}
      >
        {/* TOP GLOW LINE */}
        <div
          style={{
            height: 2,
            background:
              "linear-gradient(90deg, transparent,#00f5d4,#00b4d8,#00f5d4,transparent)",
            backgroundSize: "300%",
            animation: "glowLine 6s linear infinite",
            boxShadow: "0 0 10px #00f5d4",
          }}
        />

        {/* TOP INFO */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "8px 20px",
            fontSize: 11,
            color: "#7ab8d4",
            borderBottom: "1px solid rgba(13,58,92,0.6)",
          }}
        >
          <div style={{ display: "flex", gap: 20 }}>
            <span>● FAO LIVE</span>
            <span>● WFP PIPELINE</span>
            <span>● USDA PARTIAL</span>
          </div>

          <span
            style={{
              border: "1px solid #1a4a6c",
              padding: "3px 10px",
              borderRadius: 20,
            }}
          >
            UNRESTRICTED
          </span>
        </div>

        {/* MAIN */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 20px",
          }}
        >
          {/* LEFT */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div
              style={{
                width: 45,
                height: 45,
                border: "1px solid #00f5d4",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Orbitron",
                fontWeight: 800,
                color: "#00f5d4",
                boxShadow: "0 0 18px rgba(0,245,212,0.3)",
              }}
            >
              FRI
            </div>

            <div>
              <div style={{ fontWeight: 800, color: "#e8fcff", fontSize: 15 }}>
                Food Resilience Dashboard
              </div>
              <div style={{ fontSize: 11, color: "#6fa9c4", letterSpacing: 2 }}>
                INTELLIGENCE PLATFORM
              </div>
            </div>
          </div>

          {/* CENTER TABS */}
          <div style={{ display: "flex", gap: 10 }}>
            {TABS.map((tab) => {
              const isActive = pathname === tab.href;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`tab-btn ${isActive ? "tab-active" : ""}`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

            {/* ── LIVE CLOCK ── */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                border: "1px solid rgba(0,245,212,0.2)",
                background: "rgba(0,245,212,0.04)",
                padding: "5px 10px",
                borderRadius: 10,
                gap: 1,
              }}
            >
              <span className="clock-display">{time}</span>
              <span style={{ fontSize: 9, color: "#4a8fa8", letterSpacing: 1.5, fontWeight: 600 }}>
                {date}
              </span>
            </div>

            {/* ── LIVE INDICATOR ── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(239,35,60,0.08)",
                border: "1px solid rgba(239,35,60,0.3)",
                padding: "6px 10px",
                borderRadius: 10,
                color: "#ff7b8b",
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              <div className="live-dot" />
              LIVE
            </div>

            {/* ── USER ── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: "1px solid #1e4a6c",
                padding: "6px 10px",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#0d3a5c",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: "#9ad7ff",
                  fontWeight: 800,
                }}
              >
                OP
              </div>
              <span style={{ fontSize: 11 }}>OPERATIONS</span>
            </div>

            {/* ── LOGOUT ── */}
            <button className="logout-btn" onClick={handleLogout}>
              {/* Power icon */}
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              LOGOUT
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}