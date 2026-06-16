"use client";

type AlertLevel = "critical" | "high" | "info";

type AlertItem = {
  id: number;
  tag: string;
  time: string;
  message: string;
  level: AlertLevel;
};

const ALERTS: AlertItem[] = [
  {
    id: 1,
    tag: "FOOD SECURITY",
    time: "11:04",
    message: "High risk detected in the wheat supply chain.",
    level: "critical",
  },
  {
    id: 2,
    tag: "LOGISTICS",
    time: "11:07",
    message: "Transport delay reported in the northern corridor.",
    level: "high",
  },
  {
    id: 3,
    tag: "MARKET",
    time: "11:10",
    message: "Moderate increase in cereal prices across 3 monitored markets.",
    level: "info",
  },
  {
    id: 4,
    tag: "CLIMATE",
    time: "11:13",
    message: "Climate anomaly detected in a sensitive agricultural zone.",
    level: "high",
  },
];

const FONT = "'Rajdhani','Share Tech Mono',monospace";

const LEVEL_COLORS: Record<
  AlertLevel,
  { border: string; bg: string; text: string }
> = {
  critical: {
    border: "#ef233c",
    bg: "rgba(239,35,60,0.06)",
    text: "rgba(255,120,120,0.9)",
  },
  high: {
    border: "#f77f00",
    bg: "rgba(247,127,0,0.06)",
    text: "rgba(255,180,80,0.9)",
  },
  info: {
    border: "rgba(0,245,212,0.3)",
    bg: "rgba(0,245,212,0.04)",
    text: "rgba(0,245,212,0.7)",
  },
};

interface AlertFeedProps {
  alerts?: AlertItem[];
}

function AlertRow({ alert, index }: { alert: AlertItem; index: number }) {
  const c = LEVEL_COLORS[alert.level];

  return (
    <div
      style={{
        background: c.bg,
        borderLeft: `2px solid ${c.border}`,
        color: c.text,
        padding: "7px 9px",
        borderRadius: 3,
        marginBottom: 5,
        fontSize: 10,
        lineHeight: 1.4,
        fontFamily: FONT,
        animation: `alertFadeIn 0.4s ease ${index * 0.1}s both`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 2,
        }}
      >
        <span style={{ fontSize: 7, letterSpacing: 2, opacity: 0.6 }}>
          {alert.tag}
        </span>
        <span style={{ fontSize: 8, opacity: 0.4 }}>{alert.time}</span>
      </div>

      {alert.message}
    </div>
  );
}

export default function AlertFeed({ alerts = ALERTS }: AlertFeedProps) {
  return (
    <div
      style={{
        flex: 1,
        padding: "10px 12px",
        overflowY: "auto",
        borderBottom: "1px solid rgba(0,245,212,0.06)",
        fontFamily: FONT,
      }}
    >
      {/* HEADER */}
      <div
        style={{
          fontSize: 7,
          letterSpacing: 3,
          color: "rgba(0,245,212,0.35)",
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#00f5d4",
            animation: "alertPulse 1s infinite",
          }}
        />
        AI ALERT FEED · REAL TIME
      </div>

      {/* ALERTS */}
      {alerts.map((alert, i) => (
        <AlertRow key={alert.id} alert={alert} index={i} />
      ))}

      <style>{`
        @keyframes alertPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        @keyframes alertFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}