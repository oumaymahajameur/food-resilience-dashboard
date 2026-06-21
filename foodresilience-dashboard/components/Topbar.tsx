"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import InstallButton from "./InstallButton";


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

  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);

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
        now
          .toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
          .toUpperCase()
      );
    };

    tick();
    const id = setInterval(tick, 1000);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    router.push("/");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Inter:wght@400;600;800&display=swap');

        @keyframes glowLine {
          0% { background-position: 0%; }
          100% { background-position: 200%; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.7); }
        }

        @keyframes clockGlow {
          0%, 100% {
            text-shadow: 0 0 8px rgba(0,245,212,0.6);
          }
          50% {
            text-shadow: 0 0 16px rgba(0,245,212,1), 0 0 30px rgba(0,180,216,0.4);
          }
        }

        .topbar {
          width: 100%;
          background: linear-gradient(180deg, #09111f, #070f1c);
          border-bottom: 1px solid rgba(0,180,216,0.2);
          box-shadow: 0 10px 30px rgba(0,0,0,0.35);
          font-family: 'Inter', sans-serif;
          position: sticky;
          top: 0;
          z-index: 1000;
        }

        .topbar-glow-line {
          height: 2px;
          background: linear-gradient(
            90deg,
            transparent,
            #00f5d4,
            #00b4d8,
            #00f5d4,
            transparent
          );
          background-size: 300%;
          animation: glowLine 6s linear infinite;
          box-shadow: 0 0 10px #00f5d4;
        }

        .topbar-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 8px 20px;
          font-size: 11px;
          color: #7ab8d4;
          border-bottom: 1px solid rgba(13,58,92,0.6);
        }

        .topbar-sources {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }

        .topbar-status {
          border: 1px solid #1a4a6c;
          padding: 3px 10px;
          border-radius: 20px;
          white-space: nowrap;
        }

        .topbar-main {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 18px;
          padding: 14px 20px;
        }

        .topbar-brand {
          display: flex;
          gap: 12px;
          align-items: center;
          min-width: 0;
        }

        .topbar-logo {
          width: 45px;
          height: 45px;
          min-width: 45px;
          border: 1px solid #00f5d4;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Orbitron', monospace;
          font-weight: 800;
          color: #00f5d4;
          box-shadow: 0 0 18px rgba(0,245,212,0.3);
        }

        .topbar-title-block {
          min-width: 0;
        }

        .topbar-title {
          font-weight: 800;
          color: #e8fcff;
          font-size: 15px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .topbar-subtitle {
          font-size: 11px;
          color: #6fa9c4;
          letter-spacing: 2px;
          white-space: nowrap;
        }

        .topbar-tabs {
          display: flex;
          justify-content: center;
          gap: 10px;
          min-width: 0;
        }

        .tab-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 14px 16px 12px;
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

        .tab-active {
          color: #00f5d4 !important;
          border: 1px solid rgba(0,245,212,0.4);
          background: rgba(0,245,212,0.08);
        }

        .tab-active::after {
          opacity: 1;
          transform: scaleX(1);
          box-shadow: 0 0 12px #00f5d4;
        }

        .topbar-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          min-width: 0;
        }

        .clock-box {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          border: 1px solid rgba(0,245,212,0.2);
          background: rgba(0,245,212,0.04);
          padding: 5px 10px;
          border-radius: 10px;
          gap: 1px;
        }

        .clock-display {
          font-family: 'Orbitron', monospace;
          font-weight: 600;
          font-size: 13px;
          color: #00f5d4;
          letter-spacing: 2px;
          animation: clockGlow 2s ease-in-out infinite;
          white-space: nowrap;
        }

        .clock-date {
          font-size: 9px;
          color: #4a8fa8;
          letter-spacing: 1.5px;
          font-weight: 600;
          white-space: nowrap;
        }

        .live-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239,35,60,0.08);
          border: 1px solid rgba(239,35,60,0.3);
          padding: 6px 10px;
          border-radius: 10px;
          color: #ff7b8b;
          font-weight: 700;
          font-size: 11px;
          white-space: nowrap;
        }

        .live-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #ef233c;
          animation: pulse 1.2s infinite;
          box-shadow: 0 0 12px #ef233c;
        }

        .user-box {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #1e4a6c;
          padding: 6px 10px;
          border-radius: 10px;
          color: #9ecfe6;
          white-space: nowrap;
        }

        .user-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #0d3a5c;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: #9ad7ff;
          font-weight: 800;
        }

        .user-label {
          font-size: 11px;
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

        .mobile-menu-btn {
          display: none;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(0,245,212,0.3);
          background: rgba(0,245,212,0.06);
          color: #00f5d4;
          cursor: pointer;
          align-items: center;
          justify-content: center;
        }

        .mobile-panel {
          display: none;
        }

        .mobile-tabs {
          display: grid;
          gap: 10px;
        }

        .mobile-actions {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }

        @media (max-width: 1280px) {
          .topbar-main {
            grid-template-columns: auto 1fr auto;
            gap: 12px;
            padding: 12px 16px;
          }

          .tab-btn {
            padding: 12px 11px 10px;
            font-size: 11px;
          }

          .topbar-tabs {
            gap: 7px;
          }

          .user-label {
            display: none;
          }
        }

        @media (max-width: 1050px) {
          .topbar-main {
            grid-template-columns: 1fr auto;
          }

          .topbar-tabs,
          .topbar-actions {
            display: none;
          }

          .mobile-menu-btn {
            display: inline-flex;
          }

          .mobile-panel {
            display: block;
            max-height: 0;
            overflow: hidden;
            border-top: 1px solid rgba(13,58,92,0.6);
            transition: max-height .25s ease;
          }

          .mobile-panel.open {
            max-height: 620px;
          }

          .mobile-panel-inner {
            padding: 14px 16px 18px;
          }

          .mobile-tabs .tab-btn {
            width: 100%;
            justify-content: flex-start;
            padding: 13px 14px;
          }

          .mobile-actions .clock-box,
          .mobile-actions .live-box,
          .mobile-actions .user-box,
          .mobile-actions .logout-btn {
            width: 100%;
            justify-content: center;
          }

          .mobile-actions .clock-box {
            align-items: center;
          }
        }

        @media (max-width: 640px) {
          .topbar-info {
            padding: 7px 12px;
            font-size: 9px;
          }

          .topbar-sources {
            gap: 8px;
          }

          .topbar-sources span:nth-child(2),
          .topbar-sources span:nth-child(3) {
            display: none;
          }

          .topbar-status {
            padding: 3px 8px;
          }

          .topbar-main {
            padding: 10px 12px;
          }

          .topbar-logo {
            width: 38px;
            height: 38px;
            min-width: 38px;
            font-size: 12px;
          }

          .topbar-title {
            font-size: 13px;
            max-width: 210px;
          }

          .topbar-subtitle {
            font-size: 9px;
            letter-spacing: 1.4px;
          }

          .mobile-menu-btn {
            width: 38px;
            height: 38px;
          }

          .mobile-panel-inner {
            padding: 12px;
          }
        }

        @media (max-width: 380px) {
          .topbar-title {
            max-width: 170px;
          }

          .topbar-subtitle {
            display: none;
          }
        }
      `}</style>

      <nav className="topbar">
        <div className="topbar-glow-line" />

        <div className="topbar-info">
          <div className="topbar-sources">
            <span>● FAO LIVE</span>
            <span>● WFP PIPELINE</span>
            <span>● USDA PARTIAL</span>
          </div>

          <span className="topbar-status">UNRESTRICTED</span>
        </div>

        <div className="topbar-main">
          <div className="topbar-brand">
            <div className="topbar-logo">FRI</div>

            <div className="topbar-title-block">
              <div className="topbar-title">Food Resilience Dashboard</div>
              <div className="topbar-subtitle">INTELLIGENCE PLATFORM</div>
            </div>
          </div>

          <div className="topbar-tabs">
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

          <div className="topbar-actions">
            <div className="clock-box">
              <span className="clock-display">{time}</span>
              <span className="clock-date">{date}</span>
            </div>

            <div className="live-box">
              <div className="live-dot" />
              LIVE
            </div>

            <div className="user-box">
              <div className="user-avatar">OP</div>
              <span className="user-label">OPERATIONS</span>
            </div>

            <button className="logout-btn" onClick={handleLogout}>
              <LogoutIcon />
              LOGOUT
            </button>
          </div>

          <button
            className="mobile-menu-btn"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>

        <div className={`mobile-panel ${menuOpen ? "open" : ""}`}>
          <div className="mobile-panel-inner">
            <div className="mobile-tabs">
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

            <div className="mobile-actions">
              <div className="clock-box">
                <span className="clock-display">{time}</span>
                <span className="clock-date">{date}</span>
              </div>

              <div className="live-box">
                <div className="live-dot" />
                LIVE
              </div>

              <div className="user-box">
                <div className="user-avatar">OP</div>
                <span className="user-label">OPERATIONS</span>
              </div>

              <button className="logout-btn" onClick={handleLogout}>
                <LogoutIcon />
                LOGOUT
              </button>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}

function MenuIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function LogoutIcon() {
  return (
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
  );
  <InstallButton />
}