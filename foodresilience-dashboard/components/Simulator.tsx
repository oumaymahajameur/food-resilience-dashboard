'use client';
import { useState } from 'react';
import { scoreColor, type ResilienceRow } from '../hooks/StatesData';
import styles from './Simulator.module.css';

interface SimulatorProps {
  scores: ResilienceRow[];
  year:   number;
}

export default function Simulator({ scores, year }: SimulatorProps) {
  const [cpi,  setCpi]  = useState(10);
  const [snap, setSnap] = useState(0);
  const [hub,  setHub]  = useState(0);

  const baseline = scores.length > 0
    ? +(scores.reduce((a, r) => a + r.resilience_score, 0) / scores.length).toFixed(1)
    : 64.2;

  const impact = -(cpi * 0.4) + (snap * 0.15) + (hub * 0.2);
  const result = Math.max(20, Math.min(95, +(baseline + impact).toFixed(1)));
  const delta  = +(result - baseline).toFixed(1);

  const vulnerable = scores
    .filter(r => {
      const shock = -(cpi * 0.5) + (snap * 0.12) + (hub * 0.18);
      return (r.resilience_score + shock) < 40;
    })
    .sort((a, b) => a.resilience_score - b.resilience_score)
    .slice(0, 8);

  const pct = (val: number, min: number, max: number) =>
    `${((val - min) / (max - min) * 100).toFixed(1)}%`;

  return (
    <div className={styles.grid}>
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          Simulateur What-If — Chocs Systémiques
        </div>
        <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--font-mono)',marginBottom:14}}>
          Baseline: {baseline} (moy. nationale {year} · {scores.length} états)
        </div>

        {[
          {label:'Hausse CPI',val:cpi,set:setCpi,min:0,max:25,step:1,fmt:(v:number)=>`+${v}%`},
          {label:'Financement SNAP',val:snap,set:setSnap,min:-50,max:50,step:5,fmt:(v:number)=>`${v>=0?'+':''}${v}%`},
          {label:'Densité Food Hub',val:hub,set:setHub,min:-30,max:30,step:5,fmt:(v:number)=>`${v>=0?'+':''}${v}%`},
        ].map(s=>(
          <div key={s.label} className={styles.whatifRow}>
            <span className={styles.whatifLabel}>{s.label}</span>
            <input type="range" min={s.min} max={s.max} step={s.step} value={s.val}
              style={{'--pct':pct(s.val,s.min,s.max)} as React.CSSProperties}
              onChange={e=>s.set(+e.target.value)}/>
            <span className={styles.whatifVal}>{s.fmt(s.val)}</span>
          </div>
        ))}

        <div className={styles.resultBox}>
          <div className={styles.resultLabel}>Moyenne nationale projetée</div>
          <div className={styles.resultBig}>{result}</div>
          <div className={styles.resultDelta} style={{color:delta>=0?'var(--accent2)':'var(--danger)'}}>
            {delta>=0?'▲ +':'▼ '}{delta} vs baseline ({baseline})
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>États tombant sous le seuil critique <span className={styles.cardSub}>(score &lt; 40)</span></div>
        <div className={styles.impactList}>
          {scores.length===0
            ? <div className={styles.noVulnerable}>En attente des données PostgreSQL...</div>
            : vulnerable.length===0
              ? <div className={styles.noVulnerable}>Aucun État ne passe sous le seuil.</div>
              : vulnerable.map(r=>{
                  const shock=-(cpi*0.5)+(snap*0.12)+(hub*0.18);
                  const proj=Math.round(Math.max(10,r.resilience_score+shock));
                  return(
                    <div key={r.state_name} className={styles.impactRow}>
                      <span className={styles.stateAbbr}>{r.state_abbr}</span>
                      <span className={styles.stateName}>{r.state_name}</span>
                      <span className={styles.baseScore}>Base: {r.resilience_score.toFixed(1)}</span>
                      <span className={styles.projScore} style={{color:scoreColor(proj)}}>→ {proj}</span>
                    </div>
                  );
                })
          }
        </div>
      </div>
    </div>
  );
}