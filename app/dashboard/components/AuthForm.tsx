'use client'

import { supabase } from '@/foodresilience-dashboard/lib/supabase'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ToastState = { type: 'success' | 'error'; msg: string } | null

export default function AuthForm() {
  const router = useRouter()
  const [isSignup, setIsSignup] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nameUser, setNameUser] = useState('')
  const [nameCompany, setNameCompany] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), type === 'success' ? 3500 : 4500)
  }

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { name_user: nameUser, name_company: nameCompany },
          },
        })
        if (error) { showToast('error', error.message); return }
        showToast('success', 'Compte créé. Redirection en cours…')
        setTimeout(() => router.push('/dashboard'), 1800)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { showToast('error', error.message); return }
        showToast('success', 'Accès accordé. Redirection en cours…')
        setTimeout(() => router.push('/dashboard'), 1800)
      }
    } catch (err) {
      console.error(err)
      showToast('error', 'Une erreur inattendue est survenue.')
    } finally {
      setLoading(false)
    }
  }

  const subtitleText = isSignup
    ? { plain: 'Join the intelligence network — access ', highlight: 'federal resilience data' }
    : { plain: 'Welcome back — reconnect to the ', highlight: 'resilience grid' }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;500;600&display=swap');

        :root {
          --teal: #00ffd5;
          --teal-dim: #00bfa5;
          --card-bg: rgba(4, 20, 30, 0.92);
          --border: rgba(0, 255, 213, 0.18);
          --text: #c8e6e0;
          --muted: #4a7a70;
        }

        /* ── Panel wrap ── */
        .fri-panel-wrap {
          width: 420px;
          perspective: 900px;
          animation: fri-panelIn 0.8s cubic-bezier(.22,1,.36,1) both;
        }
        @keyframes fri-panelIn {
          from { opacity: 0; transform: translateX(30px) rotateY(-6deg); }
          to   { opacity: 1; transform: translateX(0) rotateY(0); }
        }

        /* ── Panel card ── */
        .fri-panel {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 30px 30px 26px;
          backdrop-filter: blur(20px);
          box-shadow:
            0 0 0 1px rgba(0,255,213,0.04),
            0 30px 80px rgba(0,0,0,0.55),
            inset 0 1px 0 rgba(0,255,213,0.10);
          position: relative;
        }

        /* HUD corners */
        .fri-panel::before { content:''; position:absolute; top:-1px; left:-1px; width:16px; height:16px; border-top:2px solid var(--teal); border-left:2px solid var(--teal); }
        .fri-panel::after  { content:''; position:absolute; bottom:-1px; right:-1px; width:16px; height:16px; border-bottom:2px solid var(--teal); border-right:2px solid var(--teal); }
        .fri-corner-tr { position:absolute; top:-1px; right:-1px; width:16px; height:16px; border-top:2px solid var(--teal); border-right:2px solid var(--teal); }
        .fri-corner-bl { position:absolute; bottom:-1px; left:-1px; width:16px; height:16px; border-bottom:2px solid var(--teal); border-left:2px solid var(--teal); }

        /* ══ SUBTITLE BOX ══ */
        .fri-subtitle-box {
          background: rgba(0,255,200,0.06);
          border: 1px solid rgba(0,255,200,0.2);
          border-left: 3px solid var(--teal);
          border-radius: 2px;
          padding: 10px 14px;
          margin-bottom: 22px;
          position: relative;
          overflow: hidden;
        }
        .fri-subtitle-box::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, rgba(0,255,200,0.08), transparent 60%);
          animation: fri-shimmer 3s ease-in-out infinite;
        }
        @keyframes fri-shimmer { 0%,100%{opacity:0.3} 50%{opacity:1} }

        .fri-subtitle-label {
          font-family: 'Orbitron', monospace;
          font-size: 8px; letter-spacing: 0.24em;
          color: var(--teal); opacity: 0.65;
          margin-bottom: 4px;
          position: relative; z-index: 1;
        }
        .fri-subtitle-text {
          font-family: 'Rajdhani', sans-serif;
          font-size: 14px; font-weight: 500;
          color: #a8e8dc; letter-spacing: 0.04em; line-height: 1.45;
          position: relative; z-index: 1;
        }
        .fri-subtitle-text em {
          font-style: normal;
          color: var(--teal);
          font-weight: 600;
        }

        /* ── Header ── */
        .fri-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .fri-header h2 {
          font-family: 'Orbitron', monospace; font-size: 16px;
          font-weight: 900; letter-spacing: 0.16em; color: #fff; margin: 0;
        }
        .fri-header-line {
          flex: 1; height: 1px;
          background: linear-gradient(90deg, rgba(0,255,200,0.5), transparent);
        }

        /* ── Tabs ── */
        .fri-tabs {
          display: grid; grid-template-columns: 1fr 1fr;
          border: 1px solid var(--border); border-radius: 3px;
          overflow: hidden; margin-bottom: 22px;
        }
        .fri-tab {
          padding: 9px; text-align: center;
          font-family: 'Orbitron', monospace; font-size: 10px; letter-spacing: 0.14em;
          cursor: pointer; color: var(--muted);
          background: transparent; border: none; outline: none;
          transition: color 0.2s, background 0.2s;
          position: relative;
        }
        .fri-tab.active { color: var(--teal); background: rgba(0,255,200,0.07); }
        .fri-tab.active::after {
          content: '';
          position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
          background: var(--teal);
          animation: fri-tabGlow 2s ease-in-out infinite alternate;
        }
        @keyframes fri-tabGlow {
          from { box-shadow: 0 0 4px var(--teal); opacity: 0.7; }
          to   { box-shadow: 0 0 12px var(--teal); opacity: 1; }
        }
        .fri-tab:hover:not(.active) { color: var(--text); }

        /* ── Fields ── */
        .fri-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
        .fri-field-full { margin-bottom: 10px; }
        .fri-field { position: relative; }
        .fri-field input {
          width: 100%;
          background: rgba(0,15,28,0.8);
          border: 1px solid rgba(0,255,213,0.14);
          border-radius: 3px;
          color: #d0ede8;
          font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 500;
          padding: 11px 12px 11px 34px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          letter-spacing: 0.03em;
          box-sizing: border-box;
        }
        .fri-field input::placeholder { color: var(--muted); font-size: 13px; }
        .fri-field input:focus {
          border-color: var(--teal);
          box-shadow: 0 0 0 2px rgba(0,255,213,0.09), 0 0 14px rgba(0,255,213,0.05);
        }
        .fri-field-icon {
          position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
          color: var(--muted); font-size: 11px; pointer-events: none;
          transition: color 0.2s;
        }
        .fri-field input:focus + .fri-field-icon { color: var(--teal); }

        /* ── Signup slide ── */
        .fri-signup-fields {
          overflow: hidden; max-height: 0; opacity: 0;
          transition: max-height 0.35s ease, opacity 0.3s ease;
        }
        .fri-signup-fields.open { max-height: 80px; opacity: 1; }

        /* ── Button ── */
        .fri-btn {
          width: 100%; margin-top: 16px; padding: 13px;
          background: rgba(0,255,213,0.07);
          border: 1px solid var(--teal); border-radius: 3px;
          color: var(--teal);
          font-family: 'Orbitron', monospace; font-size: 11px;
          font-weight: 700; letter-spacing: 0.2em;
          cursor: pointer; position: relative; overflow: hidden;
          transition: all 0.25s; outline: none;
        }
        .fri-btn::before {
          content: ''; position: absolute; top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(0,255,213,0.12), transparent);
          transition: left 0.45s ease;
        }
        .fri-btn:hover::before { left: 100%; }
        .fri-btn:hover { background: rgba(0,255,213,0.15); box-shadow: 0 0 22px rgba(0,255,213,0.15); color: #fff; }
        .fri-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        @keyframes fri-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .fri-btn.loading { animation: fri-pulse 1s ease infinite; }

        /* ── Switch link ── */
        .fri-switch {
          margin-top: 14px; text-align: center;
          font-size: 12.5px; color: var(--muted); letter-spacing: 0.05em;
        }
        .fri-switch span { color: var(--teal); cursor: pointer; transition: opacity 0.2s; }
        .fri-switch span:hover { opacity: 0.65; }

        /* ══ TOAST ══ */
        .fri-toast {
          position: fixed; top: 28px; right: 28px; z-index: 9999;
          display: flex; align-items: flex-start; gap: 14px;
          padding: 16px 20px 18px;
          background: rgba(4,16,26,0.98);
          border: 1px solid rgba(0,255,180,0.28);
          border-left: 3px solid var(--teal);
          border-radius: 6px;
          min-width: 300px; max-width: 400px;
          box-shadow:
            0 12px 50px rgba(0,0,0,0.70),
            0 0 0 1px rgba(0,255,213,0.04),
            0 0 30px rgba(0,255,180,0.06);
          backdrop-filter: blur(20px);
          overflow: hidden;
          animation: fri-toastIn 0.45s cubic-bezier(.22,1,.36,1) both;
        }
        .fri-toast.error {
          border-color: rgba(255,80,80,0.28);
          border-left-color: #FF5C5C;
          box-shadow:
            0 12px 50px rgba(0,0,0,0.70),
            0 0 0 1px rgba(255,80,80,0.04),
            0 0 30px rgba(255,60,60,0.06);
        }
        @keyframes fri-toastIn {
          from { opacity: 0; transform: translateY(-16px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .fri-toast-shimmer {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(90deg, rgba(0,255,180,0.05), transparent 55%);
          animation: fri-shimmer 2.8s ease-in-out infinite;
        }
        .fri-toast.error .fri-toast-shimmer {
          background: linear-gradient(90deg, rgba(255,80,80,0.04), transparent 55%);
        }

        .fri-toast-icon {
          width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
          background: rgba(0,255,180,0.09);
          border: 1.5px solid rgba(0,255,180,0.38);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; color: var(--teal);
          animation: fri-iconPop 0.5s 0.1s cubic-bezier(.22,1,.36,1) both;
          position: relative; z-index: 1;
        }
        .fri-toast.error .fri-toast-icon {
          background: rgba(255,80,80,0.09);
          border-color: rgba(255,90,90,0.38);
          color: #FF7070;
        }
        @keyframes fri-iconPop {
          from { transform: scale(0.35); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }

        .fri-toast-body { position: relative; z-index: 1; flex: 1; min-width: 0; }

        .fri-toast-tag {
          font-family: 'Orbitron', monospace;
          font-size: 8px; letter-spacing: 0.26em;
          color: rgba(0,255,180,0.6); margin-bottom: 3px;
        }
        .fri-toast.error .fri-toast-tag { color: rgba(255,110,110,0.65); }

        .fri-toast-title {
          font-family: 'Orbitron', monospace;
          font-size: 12px; font-weight: 700; letter-spacing: 0.09em;
          color: var(--teal); margin-bottom: 5px;
        }
        .fri-toast.error .fri-toast-title { color: #FF7575; }

        .fri-toast-msg {
          font-family: 'Rajdhani', sans-serif;
          font-size: 13px; font-weight: 500;
          color: rgba(170,235,215,0.88);
          letter-spacing: 0.03em; line-height: 1.45;
        }
        .fri-toast.error .fri-toast-msg { color: rgba(255,195,195,0.85); }

        .fri-toast-close {
          position: absolute; top: 10px; right: 12px;
          font-size: 10px; line-height: 1;
          color: rgba(0,255,180,0.28);
          cursor: pointer; background: none; border: none; outline: none;
          font-family: monospace; padding: 0;
          transition: color 0.2s;
          z-index: 2;
        }
        .fri-toast-close:hover { color: var(--teal); }
        .fri-toast.error .fri-toast-close { color: rgba(255,100,100,0.28); }
        .fri-toast.error .fri-toast-close:hover { color: #FF7070; }

        .fri-toast-bar {
          position: absolute; bottom: 0; left: 0; height: 2px;
          background: linear-gradient(90deg, var(--teal), rgba(0,255,180,0.08));
          animation: fri-toastBar 3.5s linear forwards;
        }
        .fri-toast.error .fri-toast-bar {
          background: linear-gradient(90deg, #FF5C5C, rgba(255,80,80,0.08));
          animation-duration: 4.5s;
        }
        @keyframes fri-toastBar { from { width: 100%; } to { width: 0%; } }
      `}</style>

      {/* ══ TOAST ══ */}
      {toast && (
        <div className={`fri-toast${toast.type === 'error' ? ' error' : ''}`}>
          <div className="fri-toast-shimmer" />
          <div className="fri-toast-icon">
            {toast.type === 'success' ? '✓' : '✕'}
          </div>
          <div className="fri-toast-body">
            <div className="fri-toast-tag">
              {toast.type === 'success' ? 'ACCESS GRANTED' : 'AUTH ERROR'}
            </div>
            <div className="fri-toast-title">
              {toast.type === 'success' ? 'AUTHENTICATION SUCCESSFUL' : 'ACCESS DENIED'}
            </div>
            <div className="fri-toast-msg">{toast.msg}</div>
          </div>
          <button className="fri-toast-close" onClick={() => setToast(null)}>✕</button>
          <div className="fri-toast-bar" />
        </div>
      )}

      <div className="fri-panel-wrap">
        <div className="fri-panel">
          <div className="fri-corner-tr" />
          <div className="fri-corner-bl" />

          {/* ══ SUBTITLE BOX ══ */}
          <div className="fri-subtitle-box">
            <div className="fri-subtitle-label">SYSTEM ACCESS</div>
            <div className="fri-subtitle-text">
              {subtitleText.plain}<em>{subtitleText.highlight}</em>
            </div>
          </div>

          {/* Header */}
          <div className="fri-header">
            <h2>{isSignup ? 'SIGN UP' : 'SIGN IN'}</h2>
            <div className="fri-header-line" />
          </div>

          {/* Tabs */}
          <div className="fri-tabs">
            <button
              className={`fri-tab${isSignup ? ' active' : ''}`}
              onClick={() => setIsSignup(true)}
            >
              REGISTER
            </button>
            <button
              className={`fri-tab${!isSignup ? ' active' : ''}`}
              onClick={() => setIsSignup(false)}
            >
              SIGN IN
            </button>
          </div>

          {/* Signup-only fields */}
          <div className={`fri-signup-fields${isSignup ? ' open' : ''}`}>
            <div className="fri-field-row">
              <div className="fri-field">
                <input
                  type="text"
                  placeholder="Name"
                  value={nameUser}
                  onChange={e => setNameUser(e.target.value)}
                  required={isSignup}
                />
                <span className="fri-field-icon">⬡</span>
              </div>
              <div className="fri-field">
                <input
                  type="text"
                  placeholder="Company"
                  value={nameCompany}
                  onChange={e => setNameCompany(e.target.value)}
                />
                <span className="fri-field-icon">◈</span>
              </div>
            </div>
          </div>

          {/* Common fields */}
          <div className="fri-field-full">
            <div className="fri-field">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <span className="fri-field-icon">✦</span>
            </div>
          </div>
          <div className="fri-field-full">
            <div className="fri-field">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <span className="fri-field-icon">◆</span>
            </div>
          </div>

          <button
            className={`fri-btn${loading ? ' loading' : ''}`}
            disabled={loading}
            onClick={handleSubmit as any}
          >
            {loading ? '◌  PROCESSING...' : isSignup ? '▸ CREATE ACCOUNT' : '▸ ACCESS SYSTEM'}
          </button>

          <p className="fri-switch">
            <span onClick={() => setIsSignup(!isSignup)}>
              {isSignup ? 'Already have an account? Sign in' : 'Create an account'}
            </span>
          </p>
        </div>
      </div>
    </>
  )
}