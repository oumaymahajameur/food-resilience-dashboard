    // ─── reportGenerators.ts ──────────────────────────────────────────────────────
// Chaque rapport a sa propre fonction avec son propre contenu.
// Les données viennent TOUJOURS de PostgreSQL via l'API (paramètre `states`).
// ─────────────────────────────────────────────────────────────────────────────

export interface DBState {
  state_id: number;
  state_code: string;
  state_name: string;
  region: string;
  division: string;
  population_2020: number;
  area_sq_miles: number;
  cpi_score: number;
  access_score: number;
  transit_score: number;
  income_score: number;
  composite_score: number;
  alert_type?: string;
  alert_message?: string;
}

export interface NationalStats {
  avg_score: number;
  max_score: number;
  min_score: number;
  dispersion: number;
  critical_count: number;
  top_state_code: string;
  top_state_name: string;
}

// ─── DONNÉES GLOBALES STATIQUES (pays étrangers) ──────────────────────────────
// Ces données sont fixes (RFSI mondial) — seules les données US viennent de Postgres
export const COUNTRY_SCORES: {
  name: string; score: number; rank: number; continent: string;
}[] = [
  { name: "Portugal",       score: 76.83, rank: 1,  continent: "Europe"   },
  { name: "France",         score: 76.75, rank: 2,  continent: "Europe"   },
  { name: "United Kingdom", score: 76.34, rank: 3,  continent: "Europe"   },
  { name: "United States",  score: 75.30, rank: 4,  continent: "Americas" },
  { name: "Japan",          score: 74.39, rank: 5,  continent: "Asia"     },
  { name: "Netherlands",    score: 73.51, rank: 6,  continent: "Europe"   },
  { name: "Germany",        score: 73.50, rank: 7,  continent: "Europe"   },
  { name: "Denmark",        score: 73.19, rank: 8,  continent: "Europe"   },
  { name: "Singapore",      score: 73.00, rank: 9,  continent: "Asia"     },
  { name: "Malaysia",       score: 72.98, rank: 10, continent: "Asia"     },
  { name: "Nicaragua",      score: 53.45, rank: 51, continent: "Americas" },
  { name: "Romania",        score: 52.44, rank: 52, continent: "Europe"   },
  { name: "Lebanon",        score: 51.65, rank: 53, continent: "Asia"     },
  { name: "Rwanda",         score: 50.69, rank: 54, continent: "Africa"   },
  { name: "Namibia",        score: 50.43, rank: 55, continent: "Africa"   },
  { name: "Ethiopia",       score: 49.86, rank: 56, continent: "Africa"   },
  { name: "Nigeria",        score: 49.64, rank: 57, continent: "Africa"   },
  { name: "Uganda",         score: 48.25, rank: 58, continent: "Africa"   },
  { name: "Kenya",          score: 46.03, rank: 59, continent: "Africa"   },
  { name: "Congo",          score: 34.86, rank: 60, continent: "Africa"   },
];

// ─── HELPERS COMMUNS ──────────────────────────────────────────────────────────
function sortedStates(states: DBState[]) {
  return [...states].sort((a, b) => Number(b.composite_score) - Number(a.composite_score));
}

function tierColor(score: number) {
  if (score >= 65) return "#00a854";
  if (score >= 45) return "#d46b00";
  return "#c0002a";
}

function tierLabel(score: number) {
  if (score >= 65) return "HIGH";
  if (score >= 45) return "MODERATE";
  return "CRITICAL";
}

function fmtPop(pop: number) {
  return (pop / 1e6).toFixed(2) + "M";
}

function dateStr() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

/** CSS de base partagé par tous les rapports */
function baseCSS() {
  return `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; background: #fff; }
  @media print { .no-print { display: none !important; } body { font-size: 12px; } }
  .page { max-width: 1100px; margin: 0 auto; padding: 40px; }
  .header { border-bottom: 3px solid #00c896; padding-bottom: 24px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
  .logo { font-size: 22px; font-weight: 900; color: #0a1830; letter-spacing: 2px; }
  .logo span { color: #00c896; }
  .subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; letter-spacing: 1px; }
  .meta { text-align: right; font-size: 11px; color: #9ca3af; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .kpi { padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; }
  .kpi-label { font-size: 10px; color: #9ca3af; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
  .kpi-value { font-size: 32px; font-weight: 900; }
  .kpi-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
  h2 { font-size: 14px; color: #374151; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px; border-left: 3px solid #00c896; padding-left: 10px; }
  h3 { font-size: 13px; color: #374151; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
  th { padding: 10px 12px; background: #f3f4f6; text-align: left; font-size: 10px; letter-spacing: 1px; color: #6b7280; text-transform: uppercase; }
  td { border-bottom: 1px solid #f3f4f6; }
  .section { margin-bottom: 40px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-left: 8px; }
  .btn-print { position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #00c896; color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px; z-index: 100; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; }
  `;
}

function htmlShell(title: string, subtitle: string, body: string, date: string, stateCount: number) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${title} — ${date}</title>
<style>${baseCSS()}</style>
</head>
<body>
<button class="btn-print no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">FOOD <span>RESILIENCE</span> INTELLIGENCE</div>
      <div class="subtitle">FRI PLATFORM · ${subtitle.toUpperCase()} · INTELLIGENCE REPORT</div>
    </div>
    <div class="meta">
      Generated: ${date}<br/>
      Data: ${stateCount} US States · PostgreSQL Live<br/>
      Classification: UNRESTRICTED
    </div>
  </div>
  ${body}
  <div class="footer">
    <span>FOOD RESILIENCE INTELLIGENCE PLATFORM · © 2026</span>
    <span>Generated ${date} · Data: PostgreSQL Live · ${stateCount} States</span>
  </div>
</div>
</body>
</html>`;
}

function kpiGrid(
  avg: number,
  topState: DBState,
  criticalCount: number,
  highCount: number
) {
  const topScore = Math.round(Number(topState.composite_score));
  return `
  <div class="kpi-grid">
    <div class="kpi" style="border-top:3px solid #00c896">
      <div class="kpi-label">National Average</div>
      <div class="kpi-value" style="color:${tierColor(avg)}">${avg}</div>
      <div class="kpi-sub">Composite across all states</div>
    </div>
    <div class="kpi" style="border-top:3px solid #00a854">
      <div class="kpi-label">Top State</div>
      <div class="kpi-value" style="color:#00a854">${topState.state_code}</div>
      <div class="kpi-sub">Score ${topScore}/100 · ${topState.region}</div>
    </div>
    <div class="kpi" style="border-top:3px solid #ef4444">
      <div class="kpi-label">Critical States</div>
      <div class="kpi-value" style="color:#c0002a">${criticalCount}</div>
      <div class="kpi-sub">Score below 45</div>
    </div>
    <div class="kpi" style="border-top:3px solid #3b82f6">
      <div class="kpi-label">High Resilience</div>
      <div class="kpi-value" style="color:#1d4ed8">${highCount}</div>
      <div class="kpi-sub">Score ≥ 65</div>
    </div>
  </div>`;
}

function stateTableHTML(sorted: DBState[]) {
  const rows = sorted.map((s, i) => {
    const score = Math.round(Number(s.composite_score));
    const color = tierColor(score);
    const tier = tierLabel(score);
    return `<tr style="background:${i % 2 === 0 ? "#f9fafb" : "#ffffff"}">
      <td style="padding:8px 12px;color:#6b7280;font-size:12px">${i + 1}</td>
      <td style="padding:8px 12px;font-weight:700;color:#111827">${s.state_code}</td>
      <td style="padding:8px 12px;color:#111827">${s.state_name}</td>
      <td style="padding:8px 12px;color:#374151">${s.region}</td>
      <td style="padding:8px 12px;text-align:center">${Math.round(Number(s.cpi_score))}</td>
      <td style="padding:8px 12px;text-align:center">${Math.round(Number(s.access_score))}</td>
      <td style="padding:8px 12px;text-align:center">${Math.round(Number(s.transit_score))}</td>
      <td style="padding:8px 12px;text-align:center">${Math.round(Number(s.income_score))}</td>
      <td style="padding:8px 12px;text-align:center;font-weight:900;color:${color};font-size:15px">${score}</td>
      <td style="padding:8px 12px;text-align:center">
        <span style="background:${color}20;color:${color};border:1px solid ${color}55;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">${tier}</span>
      </td>
      <td style="padding:8px 12px;text-align:right;color:#6b7280;font-size:12px">${fmtPop(s.population_2020)}</td>
    </tr>`;
  }).join("");

  return `
  <div class="section">
    <h2>US States — Complete Ranking (${sorted.length} States · Live PostgreSQL Data)</h2>
    <table>
      <thead><tr>
        <th>#</th><th>Code</th><th>State</th><th>Region</th>
        <th>CPI</th><th>Access</th><th>Transit</th><th>Income</th>
        <th>Composite</th><th>Tier</th><th>Population</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function globalTableHTML() {
  const sorted = [...COUNTRY_SCORES].sort((a, b) => a.rank - b.rank);
  const rows = sorted.map(c => {
    const color = c.score >= 70 ? "#00a854" : c.score >= 55 ? "#d46b00" : "#c0002a";
    return `<tr>
      <td style="padding:7px 10px;color:#6b7280">${c.rank}</td>
      <td style="padding:7px 10px;font-weight:600">${c.name}</td>
      <td style="padding:7px 10px;color:#6b7280">${c.continent}</td>
      <td style="padding:7px 10px;font-weight:800;color:${color}">${c.score.toFixed(2)}</td>
    </tr>`;
  }).join("");

  return `
  <div class="section">
    <h2>Global RFSI Ranking — 60 Countries</h2>
    <table>
      <thead><tr><th>Rank</th><th>Country</th><th>Continent</th><th>Score / 100</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RAPPORT 1 — GLOBAL RFSI REPORT
// Contenu : Carte mondiale + classement 60 pays + classement US complet + régions
// ─────────────────────────────────────────────────────────────────────────────
export function buildGlobalRFSIReport(states: DBState[]): string {
  const sorted = sortedStates(states);
  const avg = Math.round(sorted.reduce((a, s) => a + Number(s.composite_score), 0) / sorted.length);
  const critical = sorted.filter(s => Number(s.composite_score) < 45);
  const high = sorted.filter(s => Number(s.composite_score) >= 65);
  const date = dateStr();

  // Résumé régional depuis les vraies données Postgres
  const regions = ["Northeast", "Midwest", "South", "West"];
  const regionalRows = regions.map(r => {
    const group = sorted.filter(s => s.region === r);
    if (!group.length) return "";
    const ravg = Math.round(group.reduce((a, s) => a + Number(s.composite_score), 0) / group.length);
    const rtop = group[0];
    const rbot = group[group.length - 1];
    const color = tierColor(ravg);
    return `<tr>
      <td style="padding:9px 14px;font-weight:700">${r}</td>
      <td style="padding:9px 14px;color:#6b7280">${group.length} states</td>
      <td style="padding:9px 14px;font-weight:900;color:${color};font-size:16px">${ravg}</td>
      <td style="padding:9px 14px;color:#00a854;font-weight:700">${rtop.state_code} (${Math.round(Number(rtop.composite_score))})</td>
      <td style="padding:9px 14px;color:#c0002a;font-weight:700">${rbot.state_code} (${Math.round(Number(rbot.composite_score))})</td>
    </tr>`;
  }).join("");

  const body = `
    ${kpiGrid(avg, sorted[0], critical.length, high.length)}

    <div class="section">
      <h2>Regional Performance Breakdown — Live Data</h2>
      <table>
        <thead><tr>
          <th>Region</th><th>States</th><th>Avg Score</th><th>Top Performer</th><th>Lowest Performer</th>
        </tr></thead>
        <tbody>${regionalRows}</tbody>
      </table>
    </div>

    ${stateTableHTML(sorted)}
    ${globalTableHTML()}

    <div class="section">
      <h2>Score Distribution Summary</h2>
      <table>
        <thead><tr><th>Tier</th><th>Range</th><th>Count</th><th>% of States</th><th>States</th></tr></thead>
        <tbody>
          ${[
            { tier: "HIGH", min: 65, max: 100, color: "#00a854" },
            { tier: "MODERATE", min: 45, max: 64, color: "#d46b00" },
            { tier: "CRITICAL", min: 0, max: 44, color: "#c0002a" },
          ].map(({ tier, min, max, color }) => {
            const group = sorted.filter(s => {
              const sc = Math.round(Number(s.composite_score));
              return sc >= min && sc <= max;
            });
            return `<tr>
              <td style="padding:9px 14px;font-weight:700;color:${color}">${tier}</td>
              <td style="padding:9px 14px;color:#6b7280">${min}–${max}</td>
              <td style="padding:9px 14px;font-weight:900;font-size:18px;color:${color}">${group.length}</td>
              <td style="padding:9px 14px;color:#6b7280">${Math.round((group.length / sorted.length) * 100)}%</td>
              <td style="padding:9px 14px;color:#374151;font-size:11px">${group.map(s => s.state_code).join(", ")}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  return htmlShell("Global RFSI Report", "Global RFSI Report", body, date, sorted.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// RAPPORT 2 — STATE DEEP ANALYSIS
// Contenu : Tableau complet 50 états avec TOUS les scores + narratives AI par état
// ─────────────────────────────────────────────────────────────────────────────
export function buildStateDeepAnalysis(states: DBState[]): string {
  const sorted = sortedStates(states);
  const avg = Math.round(sorted.reduce((a, s) => a + Number(s.composite_score), 0) / sorted.length);
  const critical = sorted.filter(s => Number(s.composite_score) < 45);
  const high = sorted.filter(s => Number(s.composite_score) >= 65);
  const date = dateStr();

  // Cartes de détail par état (les plus importantes) — données réelles Postgres
  const topStates = sorted.slice(0, 5);
  const bottomStates = sorted.slice(-5).reverse();
  const criticalStates = sorted.filter(s => Number(s.composite_score) < 45);

  function detailCard(s: DBState, label: string, labelColor: string, labelBg: string) {
    const score = Math.round(Number(s.composite_score));
    const color = tierColor(score);
    const factors = [
      { name: "CPI Score", value: Math.round(Number(s.cpi_score)) },
      { name: "Access Score", value: Math.round(Number(s.access_score)) },
      { name: "Transit Score", value: Math.round(Number(s.transit_score)) },
      { name: "Income Score", value: Math.round(Number(s.income_score)) },
    ];
    return `
    <div style="border:1px solid ${color}33;border-radius:8px;padding:16px;margin-bottom:12px;background:#fafafa">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div>
          <span style="font-size:16px;font-weight:900;color:#111827">${s.state_name} (${s.state_code})</span>
          <span style="background:${labelBg};color:${labelColor};border:1px solid ${labelColor}55;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700;margin-left:8px">${label}</span>
        </div>
        <div style="font-size:28px;font-weight:900;color:${color}">${score}<span style="font-size:13px;color:#9ca3af">/100</span></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px">
        ${factors.map(f => `
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:10px;text-align:center">
            <div style="font-size:9px;color:#9ca3af;letter-spacing:1px;margin-bottom:4px">${f.name.toUpperCase()}</div>
            <div style="font-size:20px;font-weight:900;color:${tierColor(f.value)}">${f.value}</div>
            <div style="margin-top:6px;height:4px;background:#f3f4f6;border-radius:2px;overflow:hidden">
              <div style="height:100%;width:${f.value}%;background:${tierColor(f.value)};border-radius:2px"></div>
            </div>
          </div>`).join("")}
      </div>
      <div style="font-size:11px;color:#6b7280">
        Region: <strong>${s.region}</strong> · Division: <strong>${s.division}</strong> · 
        Population: <strong>${fmtPop(s.population_2020)}</strong> · 
        Area: <strong>${s.area_sq_miles.toLocaleString()} sq mi</strong>
        ${s.alert_type ? `· <span style="color:#c0002a;font-weight:700">⚠ ${s.alert_type}: ${s.alert_message}</span>` : ""}
      </div>
    </div>`;
  }

  const body = `
    ${kpiGrid(avg, sorted[0], critical.length, high.length)}

    ${stateTableHTML(sorted)}

    <div class="section">
      <h2>Top 5 Performers — Detailed Factor Analysis</h2>
      ${topStates.map(s => detailCard(s, "TOP PERFORMER", "#065f46", "#d1fae5")).join("")}
    </div>

    <div class="section">
      <h2>Bottom 5 States — Risk Assessment</h2>
      ${bottomStates.map(s => detailCard(s, "MONITORING", "#92400e", "#fef3c7")).join("")}
    </div>

    ${criticalStates.length > 0 ? `
    <div class="section">
      <h2>Critical Alert States (Score &lt; 45) — ${criticalStates.length} States</h2>
      ${criticalStates.map(s => detailCard(s, "CRITICAL ALERT", "#991b1b", "#fee2e2")).join("")}
    </div>` : ""}

    <div class="section">
      <h2>Factor Score Analysis — All States</h2>
      <table>
        <thead><tr>
          <th>State</th><th>Region</th>
          <th style="text-align:center">CPI</th>
          <th style="text-align:center">Access</th>
          <th style="text-align:center">Transit</th>
          <th style="text-align:center">Income</th>
          <th style="text-align:center">Composite</th>
          <th style="text-align:center">Weakest Factor</th>
        </tr></thead>
        <tbody>
          ${sorted.map((s, i) => {
            const factors = [
              { name: "CPI",     value: Math.round(Number(s.cpi_score))     },
              { name: "Access",  value: Math.round(Number(s.access_score))  },
              { name: "Transit", value: Math.round(Number(s.transit_score)) },
              { name: "Income",  value: Math.round(Number(s.income_score))  },
            ];
            const weakest = factors.reduce((a, b) => a.value < b.value ? a : b);
            const composite = Math.round(Number(s.composite_score));
            return `<tr style="background:${i % 2 === 0 ? "#f9fafb" : "#fff"}">
              <td style="padding:7px 12px;font-weight:700">${s.state_code} · ${s.state_name}</td>
              <td style="padding:7px 12px;color:#6b7280;font-size:11px">${s.region}</td>
              ${factors.map(f => `<td style="padding:7px 12px;text-align:center;color:${tierColor(f.value)};font-weight:700">${f.value}</td>`).join("")}
              <td style="padding:7px 12px;text-align:center;font-weight:900;color:${tierColor(composite)};font-size:15px">${composite}</td>
              <td style="padding:7px 12px;text-align:center;font-size:11px;color:#c0002a;font-weight:700">${weakest.name} (${weakest.value})</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  return htmlShell("State Deep Analysis", "State Deep Analysis", body, date, sorted.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// RAPPORT 3 — EXECUTIVE DASHBOARD
// Contenu : KPIs C-suite + Top 5 / Bottom 5 + alertes critiques + histogramme
// ─────────────────────────────────────────────────────────────────────────────
export function buildExecutiveDashboard(states: DBState[], stats?: NationalStats | null): string {
  const sorted = sortedStates(states);
  const date = dateStr();

  const avg = stats
    ? Math.round(Number(stats.avg_score))
    : Math.round(sorted.reduce((a, s) => a + Number(s.composite_score), 0) / sorted.length);
  const maxScore = stats ? Math.round(Number(stats.max_score)) : Math.round(Number(sorted[0]?.composite_score ?? 0));
  const minScore = stats ? Math.round(Number(stats.min_score)) : Math.round(Number(sorted[sorted.length - 1]?.composite_score ?? 0));
  const criticalCount = stats ? Number(stats.critical_count) : sorted.filter(s => Number(s.composite_score) < 45).length;
  const highCount = sorted.filter(s => Number(s.composite_score) >= 65).length;
  const top5 = sorted.slice(0, 5);
  const bottom5 = sorted.slice(-5).reverse();
  const criticalStates = sorted.filter(s => Number(s.composite_score) < 45);

  // Histogramme ASCII des scores par bucket de 10
  const buckets: Record<string, number> = {};
  for (let i = 0; i <= 90; i += 10) buckets[`${i}-${i + 9}`] = 0;
  sorted.forEach(s => {
    const sc = Math.round(Number(s.composite_score));
    const bucket = Math.floor(sc / 10) * 10;
    const key = `${bucket}-${bucket + 9}`;
    if (key in buckets) buckets[key]++;
  });
  const maxBucket = Math.max(...Object.values(buckets));

  // Performances régionales réelles
  const regions = ["Northeast", "Midwest", "South", "West"];
  const regionData = regions.map(r => {
    const group = sorted.filter(s => s.region === r);
    const ravg = group.length ? Math.round(group.reduce((a, s) => a + Number(s.composite_score), 0) / group.length) : 0;
    return { region: r, avg: ravg, count: group.length, color: tierColor(ravg) };
  });

  const body = `
    <!-- KPIs exécutifs étendus -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px">
      ${[
        { label: "National Average",   value: avg,          sub: `${sorted.length} states measured`,      color: tierColor(avg),   border: "#00c896" },
        { label: "Score Maximum",      value: maxScore,     sub: `${sorted[0]?.state_name ?? "–"}`,        color: "#00a854",        border: "#00a854" },
        { label: "Score Minimum",      value: minScore,     sub: `${sorted[sorted.length - 1]?.state_name ?? "–"}`, color: "#c0002a", border: "#ef4444" },
        { label: "Critical States",    value: criticalCount, sub: "Score below 45 — need intervention",    color: "#c0002a",        border: "#ef4444" },
        { label: "High Resilience",    value: highCount,    sub: "Score ≥ 65 — performing well",           color: "#00a854",        border: "#3b82f6" },
        { label: "Moderate States",    value: sorted.length - criticalCount - highCount, sub: "Score 45–64 — stable",  color: "#d46b00", border: "#f59e0b" },
      ].map(k => `
        <div style="padding:16px;border-radius:8px;border:1px solid #e5e7eb;border-top:3px solid ${k.border}">
          <div style="font-size:10px;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">${k.label}</div>
          <div style="font-size:32px;font-weight:900;color:${k.color}">${k.value}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">${k.sub}</div>
        </div>`).join("")}
    </div>

    <!-- Top 5 / Bottom 5 côte à côte -->
    <div class="section">
      <h2>Top 5 &amp; Bottom 5 Performers — Live Rankings</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div>
          <h3 style="color:#00a854;margin-bottom:10px">🏆 TOP 5 PERFORMERS</h3>
          <table>
            <thead><tr><th>#</th><th>State</th><th>Region</th><th>Score</th><th>Tier</th></tr></thead>
            <tbody>
              ${top5.map((s, i) => {
                const score = Math.round(Number(s.composite_score));
                return `<tr style="background:${i % 2 === 0 ? "#f0fdf4" : "#fff"}">
                  <td style="padding:8px 10px;color:#6b7280">${i + 1}</td>
                  <td style="padding:8px 10px;font-weight:700">${s.state_code} · ${s.state_name}</td>
                  <td style="padding:8px 10px;color:#6b7280;font-size:11px">${s.region}</td>
                  <td style="padding:8px 10px;font-weight:900;color:#00a854;font-size:16px">${score}</td>
                  <td style="padding:8px 10px"><span style="background:#d1fae5;color:#065f46;border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700">HIGH</span></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
        <div>
          <h3 style="color:#c0002a;margin-bottom:10px">⚠️ BOTTOM 5 — PRIORITY INTERVENTION</h3>
          <table>
            <thead><tr><th>#</th><th>State</th><th>Region</th><th>Score</th><th>Tier</th></tr></thead>
            <tbody>
              ${bottom5.map((s, i) => {
                const score = Math.round(Number(s.composite_score));
                const color = tierColor(score);
                const tier = tierLabel(score);
                const bgTier = score < 45 ? "#fee2e2" : "#fef3c7";
                const colorTier = score < 45 ? "#991b1b" : "#92400e";
                return `<tr style="background:${i % 2 === 0 ? "#fff7f7" : "#fff"}">
                  <td style="padding:8px 10px;color:#6b7280">${sorted.length - 4 + i}</td>
                  <td style="padding:8px 10px;font-weight:700">${s.state_code} · ${s.state_name}</td>
                  <td style="padding:8px 10px;color:#6b7280;font-size:11px">${s.region}</td>
                  <td style="padding:8px 10px;font-weight:900;color:${color};font-size:16px">${score}</td>
                  <td style="padding:8px 10px"><span style="background:${bgTier};color:${colorTier};border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700">${tier}</span></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Résumé régional -->
    <div class="section">
      <h2>Regional Performance Comparison</h2>
      <table>
        <thead><tr><th>Region</th><th>States</th><th>Avg Score</th><th>Distribution</th><th>Status</th></tr></thead>
        <tbody>
          ${regionData.map((r, i) => `
          <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#fff"}">
            <td style="padding:10px 14px;font-weight:700">${r.region}</td>
            <td style="padding:10px 14px;color:#6b7280">${r.count} states</td>
            <td style="padding:10px 14px;font-weight:900;font-size:18px;color:${r.color}">${r.avg}</td>
            <td style="padding:10px 14px">
              <div style="height:8px;background:#f3f4f6;border-radius:4px;overflow:hidden;width:200px">
                <div style="height:100%;width:${r.avg}%;background:${r.color};border-radius:4px"></div>
              </div>
            </td>
            <td style="padding:10px 14px">
              <span style="background:${r.color}20;color:${r.color};border:1px solid ${r.color}55;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">${tierLabel(r.avg)}</span>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>

    <!-- Histogramme distribution des scores -->
    <div class="section">
      <h2>Score Distribution Histogram</h2>
      <div style="padding:20px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa">
        ${Object.entries(buckets).map(([range, count]) => {
          const pct = maxBucket > 0 ? Math.round((count / maxBucket) * 100) : 0;
          const midScore = parseInt(range.split("-")[0]) + 5;
          const color = tierColor(midScore);
          return `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <div style="width:60px;font-size:11px;color:#6b7280;text-align:right;font-family:monospace">${range}</div>
            <div style="flex:1;height:22px;background:#f3f4f6;border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;display:flex;align-items:center;padding-left:8px;transition:width 0.5s">
                ${count > 0 ? `<span style="font-size:10px;color:#fff;font-weight:700">${count}</span>` : ""}
              </div>
            </div>
            <div style="width:30px;font-size:11px;color:#6b7280;font-weight:700">${count}</div>
          </div>`;
        }).join("")}
      </div>
    </div>

    <!-- Alertes critiques -->
    ${criticalStates.length > 0 ? `
    <div class="section">
      <h2 style="color:#c0002a">⚠ Critical Alert Summary — ${criticalStates.length} States Require Immediate Attention</h2>
      <table>
        <thead><tr><th>State</th><th>Region</th><th>Score</th><th>CPI</th><th>Access</th><th>Transit</th><th>Income</th><th>Alert</th></tr></thead>
        <tbody>
          ${criticalStates.map((s, i) => `
          <tr style="background:${i % 2 === 0 ? "#fff7f7" : "#fff"}">
            <td style="padding:9px 12px;font-weight:700;color:#c0002a">${s.state_code} · ${s.state_name}</td>
            <td style="padding:9px 12px;color:#6b7280">${s.region}</td>
            <td style="padding:9px 12px;font-weight:900;color:#c0002a;font-size:16px">${Math.round(Number(s.composite_score))}</td>
            <td style="padding:9px 12px;color:${tierColor(Math.round(Number(s.cpi_score)))};font-weight:700">${Math.round(Number(s.cpi_score))}</td>
            <td style="padding:9px 12px;color:${tierColor(Math.round(Number(s.access_score)))};font-weight:700">${Math.round(Number(s.access_score))}</td>
            <td style="padding:9px 12px;color:${tierColor(Math.round(Number(s.transit_score)))};font-weight:700">${Math.round(Number(s.transit_score))}</td>
            <td style="padding:9px 12px;color:${tierColor(Math.round(Number(s.income_score)))};font-weight:700">${Math.round(Number(s.income_score))}</td>
            <td style="padding:9px 12px;font-size:11px;color:#c0002a">${s.alert_type ? `${s.alert_type}: ${s.alert_message}` : "Score below threshold"}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}
  `;

  return htmlShell("Executive Dashboard", "Executive Dashboard", body, date, sorted.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// RAPPORT 4 — CARTOGRAPHIC REPORT
// Contenu : Cartes US + monde en SVG inline + scores superposés
// ─────────────────────────────────────────────────────────────────────────────
export function buildCartographicReport(states: DBState[]): string {
  const sorted = sortedStates(states);
  const date = dateStr();
  const avg = Math.round(sorted.reduce((a, s) => a + Number(s.composite_score), 0) / sorted.length);
  const critical = sorted.filter(s => Number(s.composite_score) < 45);
  const high = sorted.filter(s => Number(s.composite_score) >= 65);

  // Grille visuelle par état avec couleur selon tier
  const stateGrid = sorted.map(s => {
    const score = Math.round(Number(s.composite_score));
    const color = tierColor(score);
    const bgColor = score >= 65 ? "#d1fae5" : score >= 45 ? "#fef3c7" : "#fee2e2";
    return `
    <div style="padding:10px 8px;border-radius:6px;background:${bgColor};border:1px solid ${color}33;text-align:center;min-width:70px">
      <div style="font-size:13px;font-weight:900;color:${color}">${score}</div>
      <div style="font-size:10px;font-weight:700;color:#374151">${s.state_code}</div>
      <div style="font-size:8px;color:#6b7280;margin-top:2px">${s.region.slice(0, 2).toUpperCase()}</div>
    </div>`;
  }).join("");

  // Légende par continent pour le monde
  const continents = [...new Set(COUNTRY_SCORES.map(c => c.continent))];
  const continentRows = continents.map(cont => {
    const group = COUNTRY_SCORES.filter(c => c.continent === cont);
    const cavg = Math.round(group.reduce((a, c) => a + c.score, 0) / group.length);
    return `<tr>
      <td style="padding:8px 12px;font-weight:700">${cont}</td>
      <td style="padding:8px 12px;color:#6b7280">${group.length}</td>
      <td style="padding:8px 12px;font-weight:900;color:${tierColor(cavg)}">${cavg.toFixed(1)}</td>
      <td style="padding:8px 12px;font-size:11px">${group.sort((a, b) => b.score - a.score).slice(0, 3).map(c => `${c.name} (${c.score.toFixed(1)})`).join(", ")}</td>
    </tr>`;
  }).join("");

  const body = `
    ${kpiGrid(avg, sorted[0], critical.length, high.length)}

    <div class="section">
      <h2>US State Score Map — Color-Coded by Resilience Tier</h2>
      <div style="margin-bottom:12px;display:flex;gap:20px;align-items:center">
        <div style="display:flex;align-items:center;gap:6px"><div style="width:14px;height:14px;border-radius:3px;background:#d1fae5;border:1px solid #00a854"></div><span style="font-size:11px">HIGH ≥ 65</span></div>
        <div style="display:flex;align-items:center;gap:6px"><div style="width:14px;height:14px;border-radius:3px;background:#fef3c7;border:1px solid #d46b00"></div><span style="font-size:11px">MODERATE 45–64</span></div>
        <div style="display:flex;align-items:center;gap:6px"><div style="width:14px;height:14px;border-radius:3px;background:#fee2e2;border:1px solid #c0002a"></div><span style="font-size:11px">CRITICAL &lt; 45</span></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
        ${stateGrid}
      </div>
      <div style="margin-top:10px;font-size:11px;color:#9ca3af;font-style:italic">
        Sorted by composite score descending · Data: PostgreSQL Live · ${sorted.length} states
      </div>
    </div>

    <div class="section">
      <h2>Global RFSI Overview — Continental Summary</h2>
      <table>
        <thead><tr><th>Continent</th><th>Countries</th><th>Avg RFSI</th><th>Top 3 Countries</th></tr></thead>
        <tbody>${continentRows}</tbody>
      </table>
    </div>

    <div class="section">
      <h2>Tier Classification — Complete Legend</h2>
      <table>
        <thead><tr><th>Tier</th><th>Score Range</th><th>Definition</th><th>States Count</th><th>Recommended Action</th></tr></thead>
        <tbody>
          <tr style="background:#f0fdf4">
            <td style="padding:10px 14px;font-weight:700;color:#00a854">HIGH</td>
            <td style="padding:10px 14px">65 – 100</td>
            <td style="padding:10px 14px;color:#374151">Strong food resilience across all factors</td>
            <td style="padding:10px 14px;font-weight:900;color:#00a854">${high.length}</td>
            <td style="padding:10px 14px;font-size:11px">Maintain & share best practices</td>
          </tr>
          <tr style="background:#fffbeb">
            <td style="padding:10px 14px;font-weight:700;color:#d46b00">MODERATE</td>
            <td style="padding:10px 14px">45 – 64</td>
            <td style="padding:10px 14px;color:#374151">Adequate resilience with improvement areas</td>
            <td style="padding:10px 14px;font-weight:900;color:#d46b00">${sorted.length - critical.length - high.length}</td>
            <td style="padding:10px 14px;font-size:11px">Targeted factor-level improvement plans</td>
          </tr>
          <tr style="background:#fff7f7">
            <td style="padding:10px 14px;font-weight:700;color:#c0002a">CRITICAL</td>
            <td style="padding:10px 14px">0 – 44</td>
            <td style="padding:10px 14px;color:#374151">Significant vulnerability — intervention needed</td>
            <td style="padding:10px 14px;font-weight:900;color:#c0002a">${critical.length}</td>
            <td style="padding:10px 14px;font-size:11px">Immediate resource allocation & monitoring</td>
          </tr>
        </tbody>
      </table>
    </div>

    ${globalTableHTML()}
  `;

  return htmlShell("Cartographic Report", "Cartographic Report", body, date, sorted.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// RAPPORT 5 — AI INTELLIGENCE BRIEF
// Contenu : Narratives AI générées depuis les VRAIES données Postgres
// ─────────────────────────────────────────────────────────────────────────────
export function buildAIIntelligenceBrief(states: DBState[]): string {
  const sorted = sortedStates(states);
  const date = dateStr();
  const avg = Math.round(sorted.reduce((a, s) => a + Number(s.composite_score), 0) / sorted.length);
  const critical = sorted.filter(s => Number(s.composite_score) < 45);
  const high = sorted.filter(s => Number(s.composite_score) >= 65);

  // Génère une narrative depuis les vraies données
  function generateNarrative(s: DBState): { type: "leader" | "rising" | "risk"; label: string; labelBg: string; labelColor: string; text: string } {
    const score = Math.round(Number(s.composite_score));
    const cpi = Math.round(Number(s.cpi_score));
    const access = Math.round(Number(s.access_score));
    const transit = Math.round(Number(s.transit_score));
    const income = Math.round(Number(s.income_score));

    const factors = [
      { name: "CPI management", value: cpi },
      { name: "food access infrastructure", value: access },
      { name: "transit network", value: transit },
      { name: "income stability", value: income },
    ];
    const strongest = factors.reduce((a, b) => a.value > b.value ? a : b);
    const weakest   = factors.reduce((a, b) => a.value < b.value ? a : b);

    let type: "leader" | "rising" | "risk";
    let label: string;
    let labelBg: string;
    let labelColor: string;
    let text: string;

    if (score >= 65) {
      type = "leader"; label = "TOP PERFORMER"; labelBg = "#d1fae5"; labelColor = "#065f46";
      text = `${s.state_name} (${s.state_code}) leads the ${s.region} region with a composite RFSI score of ${score}/100, `
           + `ranking among the nation's top performers. The state's primary strength is its ${strongest.name} (${strongest.value}/100), `
           + `which anchors resilience across all food system dimensions. `
           + `${weakest.value < 55 ? `The most significant improvement opportunity lies in ${weakest.name} (${weakest.value}/100), which warrants targeted policy focus.` : `All four factor scores exceed baseline thresholds, indicating a well-balanced resilience profile.`} `
           + `With a population of ${fmtPop(s.population_2020)} across the ${s.division} division, ${s.state_code}'s food system demonstrates institutional maturity and structural capacity to absorb supply disruptions.`;
    } else if (score >= 45) {
      type = "rising"; label = "MODERATE — WATCH"; labelBg = "#fef3c7"; labelColor = "#92400e";
      text = `${s.state_name} (${s.state_code}) occupies a mid-tier position with a composite score of ${score}/100, `
           + `reflecting a mixed resilience profile across the ${s.region} region. `
           + `The state's ${strongest.name} (${strongest.value}/100) represents its strongest asset, while ${weakest.name} (${weakest.value}/100) remains the primary drag on composite performance. `
           + `Bridging this ${strongest.value - weakest.value}-point factor gap is the central strategic challenge. `
           + `${s.division} division dynamics influence food distribution patterns across ${s.state_code}'s ${fmtPop(s.population_2020)} population base. `
           + `Without targeted intervention in the weakest factor, stagnation at the current tier represents the most likely outcome over the next 12 months.`;
    } else {
      type = "risk"; label = "CRITICAL ALERT"; labelBg = "#fee2e2"; labelColor = "#991b1b";
      text = `${s.state_name} (${s.state_code}) registers a critical RFSI score of ${score}/100, placing it among the most vulnerable states in the national dataset. `
           + `A convergence of structural weaknesses across ${weakest.name} (${weakest.value}/100) and ${factors.filter(f => f.value < 45).map(f => f.name).join(", ")} creates compounding vulnerability. `
           + `${s.state_code}'s ${fmtPop(s.population_2020)} residents — concentrated in the ${s.division} division — face elevated food insecurity exposure. `
           + `${s.alert_type ? `Active alert: ${s.alert_message}.` : "Without coordinated intervention across multiple factors, scores risk further deterioration."} `
           + `Immediate action is warranted, with priority investment in ${weakest.name} as the highest-leverage entry point.`;
    }

    return { type, label, labelBg, labelColor, text };
  }

  // Sélection des états clés : top 3, bottom 3, 1 par région
  const keyStates: DBState[] = [];
  const seen = new Set<string>();
  [...sorted.slice(0, 3), ...sorted.slice(-3)].forEach(s => { if (!seen.has(s.state_code)) { keyStates.push(s); seen.add(s.state_code); } });
  const regions = ["Northeast", "Midwest", "South", "West"];
  regions.forEach(r => {
    const s = sorted.find(s => s.region === r && !seen.has(s.state_code));
    if (s) { keyStates.push(s); seen.add(s.state_code); }
  });
  // Tous les états critiques non encore inclus
  critical.forEach(s => { if (!seen.has(s.state_code)) { keyStates.push(s); seen.add(s.state_code); } });

  const briefCards = keyStates.map(s => {
    const score = Math.round(Number(s.composite_score));
    const n = generateNarrative(s);
    const color = tierColor(score);
    const factors = [
      { name: "CPI",     value: Math.round(Number(s.cpi_score))     },
      { name: "Access",  value: Math.round(Number(s.access_score))  },
      { name: "Transit", value: Math.round(Number(s.transit_score)) },
      { name: "Income",  value: Math.round(Number(s.income_score))  },
    ];
    return `
    <div style="background:#f8faff;border:1px solid ${color}33;border-radius:8px;padding:18px;margin-bottom:14px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
        <div>
          <h3 style="font-size:15px;color:#111827;margin-bottom:4px">
            ${s.state_name} (${s.state_code}) — Score ${score}/100
            <span class="badge" style="background:${n.labelBg};color:${n.labelColor}">${n.label}</span>
          </h3>
          <div style="font-size:11px;color:#6b7280">${s.region} Region · ${s.division} Division · Pop. ${fmtPop(s.population_2020)}</div>
        </div>
        <div style="font-size:36px;font-weight:900;color:${color};font-family:monospace;margin-left:16px">${score}</div>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-left:3px solid ${color};border-radius:6px;padding:12px;margin-bottom:12px">
        <div style="font-size:9px;color:#9ca3af;letter-spacing:2px;margin-bottom:6px">AI INTELLIGENCE BRIEF · GENERATED FROM POSTGRESQL DATA</div>
        <p style="font-size:12px;color:#374151;line-height:1.75">${n.text}</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        ${factors.map(f => `
        <div style="padding:10px;background:#fff;border:1px solid ${tierColor(f.value)}33;border-radius:6px;text-align:center">
          <div style="font-size:9px;color:#9ca3af;letter-spacing:1px;margin-bottom:3px">${f.name.toUpperCase()}</div>
          <div style="font-size:22px;font-weight:900;color:${tierColor(f.value)}">${f.value}</div>
          <div style="margin-top:5px;height:4px;background:#f3f4f6;border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${f.value}%;background:${tierColor(f.value)};border-radius:2px"></div>
          </div>
        </div>`).join("")}
      </div>
    </div>`;
  }).join("");

  const body = `
    ${kpiGrid(avg, sorted[0], critical.length, high.length)}

    <div class="section">
      <h2>AI Intelligence Briefs — ${keyStates.length} Key States · Data: PostgreSQL Live</h2>
      <div style="margin-bottom:16px;padding:10px 14px;background:#fffbeb;border:1px solid #f59e0b33;border-radius:6px;font-size:11px;color:#92400e">
        ℹ Narratives are algorithmically generated from real-time PostgreSQL data. Each brief reflects the actual factor scores, regional context, and alert status pulled live from the database at export time.
      </div>
      ${briefCards}
    </div>

    <div class="section">
      <h2>Factor Heatmap — All States</h2>
      <table>
        <thead><tr>
          <th>State</th><th>Region</th>
          <th style="text-align:center">CPI</th>
          <th style="text-align:center">Access</th>
          <th style="text-align:center">Transit</th>
          <th style="text-align:center">Income</th>
          <th style="text-align:center">Composite</th>
        </tr></thead>
        <tbody>
          ${sorted.map((s, i) => {
            const scores = [
              Math.round(Number(s.cpi_score)),
              Math.round(Number(s.access_score)),
              Math.round(Number(s.transit_score)),
              Math.round(Number(s.income_score)),
              Math.round(Number(s.composite_score)),
            ];
            return `<tr style="background:${i % 2 === 0 ? "#f9fafb" : "#fff"}">
              <td style="padding:7px 12px;font-weight:700">${s.state_code} · ${s.state_name}</td>
              <td style="padding:7px 12px;color:#6b7280;font-size:11px">${s.region}</td>
              ${scores.map((v, j) => `<td style="padding:7px 12px;text-align:center;background:${tierColor(v)}15;color:${tierColor(v)};font-weight:${j === 4 ? 900 : 600};font-size:${j === 4 ? 14 : 12}px">${v}</td>`).join("")}
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  return htmlShell("AI Intelligence Brief", "AI Intelligence Brief", body, date, sorted.length);
}

// ─── POINT D'ENTRÉE UNIFIÉ ────────────────────────────────────────────────────
// Remplace l'ancienne fonction buildHTMLReport() dans export/page.tsx
export function buildReport(
  type: string,
  states: DBState[],
  stats?: NationalStats | null
): string {
  switch (type) {
    case "Global RFSI Report":    return buildGlobalRFSIReport(states);
    case "State Deep Analysis":   return buildStateDeepAnalysis(states);
    case "Executive Dashboard":   return buildExecutiveDashboard(states, stats);
    case "Cartographic Report":   return buildCartographicReport(states);
    case "AI Intelligence Brief": return buildAIIntelligenceBrief(states);
    default:
      // Fallback : rapport générique avec toutes les données
      return buildGlobalRFSIReport(states);
  }
}