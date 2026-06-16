"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import AuthForm from "./dashboard/components/AuthForm";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

interface DataArc {
  lat1: number; lon1: number; lat2: number; lon2: number;
  progress: number; speed: number; colorIdx: number;
}

const US_NODES = [
  { lat: 40.71, lon: -74.01, label: "NY" },
  { lat: 34.05, lon: -118.24, label: "LA" },
  { lat: 41.88, lon: -87.63, label: "CHI" },
  { lat: 29.76, lon: -95.37, label: "HOU" },
  { lat: 33.45, lon: -112.07, label: "PHX" },
  { lat: 39.95, lon: -75.16, label: "PHL" },
  { lat: 37.77, lon: -122.42, label: "SF" },
  { lat: 47.61, lon: -122.33, label: "SEA" },
  { lat: 39.74, lon: -104.98, label: "DEN" },
  { lat: 32.78, lon: -96.80, label: "DAL" },
  { lat: 30.27, lon: -97.74, label: "AUS" },
  { lat: 44.98, lon: -93.27, label: "MIN" },
  { lat: 36.17, lon: -86.78, label: "NSH" },
  { lat: 35.23, lon: -80.84, label: "CLT" },
  { lat: 32.72, lon: -117.15, label: "SD" },
];

const ARC_PALETTE: [number, number, number][] = [
  [0, 255, 180],
  [80, 200, 255],
  [160, 80, 255],
  [255, 180, 0],
  [0, 180, 255],
];

// ─── Safe arc helper ──────────────────────────────────────────────────────────
// Prevents IndexSizeError when radius is negative (happens when depth-scaled
// values go below zero during globe rotation).
function safeArc(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  startAngle: number, endAngle: number
) {
  const safeR = Math.max(0, r);
  ctx.arc(x, y, safeR, startAngle, endAngle);
}

// ─── Globe ────────────────────────────────────────────────────────────────────
function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const S = useRef({
    rot: 0.4, tilt: 0.18,
    dragging: false, lastX: 0, lastY: 0, autoRot: true,
    arcs: [] as DataArc[],
    raf: 0, time: 0,
    W: 0, H: 0, dpr: 1,
    stars: [] as { x: number; y: number; r: number; base: number; speed: number }[],
  });

  const project = useCallback(
    (lat: number, lon: number, R: number, cx: number, cy: number) => {
      if (!isFinite(lat) || !isFinite(lon) || !isFinite(R) || !isFinite(cx) || !isFinite(cy)) {
        return { sx: 0, sy: 0, depth: -R, visible: false, z: -1 };
      }
      const { rot, tilt } = S.current;
      const phi   = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180) + rot;
      const x0 = -R * Math.sin(phi) * Math.cos(theta);
      const y0 =  R * Math.cos(phi);
      const z0 =  R * Math.sin(phi) * Math.sin(theta);
      const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
      const sy = cy - (y0 * cosT - z0 * sinT);
      const depth = y0 * sinT + z0 * cosT;
      const sx = cx + x0;
      if (!isFinite(sx) || !isFinite(sy)) {
        return { sx: 0, sy: 0, depth: -R, visible: false, z: -1 };
      }
      return { sx, sy, depth, visible: depth > -R * 0.05, z: depth / R };
    }, []
  );

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const s = S.current;

    s.arcs = Array.from({ length: 16 }, () => {
      const a = US_NODES[Math.floor(Math.random() * US_NODES.length)];
      const b = US_NODES[Math.floor(Math.random() * US_NODES.length)];
      return {
        lat1: a.lat, lon1: a.lon, lat2: b.lat, lon2: b.lon,
        progress: Math.random(), speed: 0.002 + Math.random() * 0.0018,
        colorIdx: Math.floor(Math.random() * ARC_PALETTE.length),
      };
    });

    s.stars = Array.from({ length: 140 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.0 + 0.25,
      base: Math.random(), speed: 0.5 + Math.random() * 1.5,
    }));

    const resize = () => {
      s.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width  = w * s.dpr;
      canvas.height = h * s.dpr;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      s.W = w; s.H = h;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onDown = (x: number, y: number) => { s.dragging = true; s.autoRot = false; s.lastX = x; s.lastY = y; };
    const onUp   = () => { s.dragging = false; s.autoRot = true; };
    const onMove = (x: number, y: number) => {
      if (!s.dragging) return;
      s.rot  += (x - s.lastX) * 0.005;
      s.tilt  = Math.max(-0.6, Math.min(0.6, s.tilt + (y - s.lastY) * 0.003));
      s.lastX = x; s.lastY = y;
    };

    const onMD = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); onDown(e.clientX - r.left, e.clientY - r.top); };
    const onMM = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); onMove(e.clientX - r.left, e.clientY - r.top); };
    const onTS = (e: TouchEvent) => { const r = canvas.getBoundingClientRect(); onDown(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top); };
    const onTM = (e: TouchEvent) => { const r = canvas.getBoundingClientRect(); onMove(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top); };

    canvas.addEventListener("mousedown",  onMD);
    canvas.addEventListener("mousemove",  onMM);
    canvas.addEventListener("mouseup",    onUp);
    canvas.addEventListener("mouseleave", onUp);
    canvas.addEventListener("touchstart", onTS, { passive: true });
    canvas.addEventListener("touchmove",  onTM, { passive: true });
    canvas.addEventListener("touchend",   onUp);

    const STEPS = 60, TAIL = 22;

    const draw = () => {
      s.raf = requestAnimationFrame(draw);
      s.time += 0.016;
      const t = s.time;
      if (s.autoRot) s.rot += 0.0022;

      const { W, H } = s;
      if (!W || !H) return;
      const cx = W / 2, cy = H / 2;
      const R  = Math.min(W, H) * 0.42;
      if (R <= 0) return;

      ctx.fillStyle = "#050810";
      ctx.fillRect(0, 0, W, H);

      // Stars
      s.stars.forEach((st) => {
        const op = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * st.speed + st.base * 99));
        ctx.globalAlpha = op;
        ctx.fillStyle = "#C8DEFF";
        ctx.beginPath();
        safeArc(ctx, st.x * W, st.y * H, st.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Rings
      const ringDefs: [string, number, number][] = [
        ["0,255,180", R * 1.07, 0.32],
        ["77,168,255", R * 1.16, 0.18],
        ["160,80,255", R * 1.26, 0.10],
      ];
      ringDefs.forEach(([c, rr, alpha], i) => {
        const pulse = 0.55 + 0.45 * Math.sin(t * 0.7 + i * 1.4);
        ctx.beginPath();
        safeArc(ctx, cx, cy, rr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c},${alpha * pulse})`;
        ctx.lineWidth = i === 0 ? 2 : 1.2;
        ctx.stroke();
      });

      // Dashed orbit rings
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.13);
      ctx.beginPath(); safeArc(ctx, 0, 0, R * 1.21, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,255,180,0.10)"; ctx.lineWidth = 1;
      ctx.setLineDash([5, 20]); ctx.stroke(); ctx.setLineDash([]); ctx.restore();

      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-t * 0.08);
      ctx.beginPath(); safeArc(ctx, 0, 0, R * 1.35, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(77,168,255,0.07)"; ctx.lineWidth = 1;
      ctx.setLineDash([3, 26]); ctx.stroke(); ctx.setLineDash([]); ctx.restore();

      // Atmosphere glow
      const atm = ctx.createRadialGradient(cx, cy, R * 0.84, cx, cy, R * 1.42);
      atm.addColorStop(0,   "rgba(0,255,180,0.09)");
      atm.addColorStop(0.3, "rgba(30,120,255,0.07)");
      atm.addColorStop(0.7, "rgba(130,50,255,0.04)");
      atm.addColorStop(1,   "transparent");
      ctx.beginPath(); safeArc(ctx, cx, cy, R * 1.42, 0, Math.PI * 2);
      ctx.fillStyle = atm; ctx.fill();

      // Globe body
      const globeGrd = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.01, cx + R * 0.1, cy + R * 0.1, R * 1.2);
      globeGrd.addColorStop(0,   "#1E6FA0");
      globeGrd.addColorStop(0.2, "#0E4070");
      globeGrd.addColorStop(0.5, "#071E48");
      globeGrd.addColorStop(0.8, "#040F2A");
      globeGrd.addColorStop(1,   "#010610");
      ctx.beginPath(); safeArc(ctx, cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = globeGrd; ctx.fill();

      // Clip globe surface
      ctx.save();
      ctx.beginPath(); safeArc(ctx, cx, cy, Math.max(0, R - 0.5), 0, Math.PI * 2); ctx.clip();

      // Latitude lines
      for (let lat = -75; lat <= 75; lat += 15) {
        ctx.beginPath(); let wasVis = false;
        for (let lon = -180; lon <= 181; lon += 3) {
          const p = project(lat, lon, R, cx, cy);
          if (p.visible) { if (!wasVis) ctx.moveTo(p.sx, p.sy); else ctx.lineTo(p.sx, p.sy); }
          wasVis = p.visible;
        }
        ctx.strokeStyle = lat === 0 ? "rgba(0,220,160,0.50)" : "rgba(0,180,140,0.15)";
        ctx.lineWidth = lat === 0 ? 1.4 : 0.6;
        ctx.stroke();
      }

      // Longitude lines
      for (let lon = -180; lon < 180; lon += 20) {
        ctx.beginPath(); let wasVis = false;
        for (let lat = -90; lat <= 90; lat += 3) {
          const p = project(lat, lon, R, cx, cy);
          if (p.visible) { if (!wasVis) ctx.moveTo(p.sx, p.sy); else ctx.lineTo(p.sx, p.sy); }
          wasVis = p.visible;
        }
        ctx.strokeStyle = "rgba(60,150,255,0.13)";
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }

      // Continental outlines
      const continentPaths: [number, number][][] = [
        [[70,-140],[72,-120],[68,-95],[72,-80],[65,-65],[58,-65],[50,-56],[47,-53],[45,-60],[42,-66],[35,-75],[30,-80],[25,-80],[20,-87],[16,-86],[10,-83],[8,-77],[9,-75],[10,-62],[12,-60],[14,-60],[17,-62],[20,-72],[25,-77],[32,-80],[36,-76],[38,-75],[41,-70],[43,-70],[46,-64],[50,-64],[53,-56],[55,-60],[60,-64],[63,-68],[60,-78],[55,-78],[50,-81],[48,-90],[46,-84],[45,-75],[44,-76],[43,-80],[41,-82],[42,-83],[43,-83],[45,-84],[47,-85],[49,-88],[50,-97],[50,-97],[53,-100],[53,-110],[50,-114],[49,-123],[45,-124],[40,-124],[36,-122],[32,-117],[28,-110],[24,-110],[20,-105],[16,-99],[16,-90],[18,-88],[22,-90],[20,-87],[18,-92],[17,-94],[20,-97],[20,-99],[20,-100],[22,-100],[24,-104],[26,-108],[29,-110],[31,-113],[33,-116],[36,-120],[39,-122],[40,-124],[42,-124],[44,-124],[47,-122],[48,-122],[49,-123],[50,-124],[54,-132],[55,-130],[58,-136],[60,-146],[62,-150],[60,-150],[58,-152],[56,-158],[52,-168],[52,-175],[55,-165],[60,-166],[63,-163],[66,-164],[68,-166],[68,-163],[70,-162],[72,-157],[70,-148],[70,-140]],
        [[36,6],[37,10],[38,15],[40,18],[38,20],[37,21],[36,23],[36,28],[41,29],[42,28],[43,26],[44,28],[45,30],[47,30],[48,22],[49,18],[50,14],[52,14],[54,12],[56,10],[58,8],[59,5],[60,5],[62,6],[64,14],[66,14],[68,16],[70,20],[70,28],[68,28],[68,30],[66,30],[65,28],[64,25],[63,22],[62,22],[60,24],[60,26],[62,28],[62,30],[60,32],[58,28],[56,26],[57,24],[58,22],[58,20],[57,20],[56,18],[55,14],[54,10],[52,8],[50,8],[48,8],[46,6],[44,8],[42,8],[40,8],[38,8],[37,6],[36,6]],
        [[36,10],[38,15],[36,18],[30,30],[22,37],[12,44],[8,40],[2,42],[0,42],[-4,40],[-10,40],[-18,36],[-22,35],[-26,33],[-30,30],[-34,26],[-35,20],[-32,16],[-28,18],[-25,15],[-20,14],[-15,12],[-10,14],[-5,10],[-4,12],[0,10],[4,6],[4,2],[8,2],[10,2],[12,4],[16,2],[18,4],[18,8],[14,14],[10,14],[8,14],[4,10],[2,8],[-2,8],[-4,8],[-2,12],[0,16],[4,18],[10,24],[16,30],[20,37],[24,38],[28,34],[30,30],[36,10]],
        [[36,28],[40,36],[42,38],[44,40],[48,45],[50,60],[54,70],[58,70],[62,70],[66,68],[70,70],[72,80],[70,100],[68,100],[64,100],[60,100],[58,110],[54,110],[50,120],[48,135],[45,138],[40,130],[36,128],[32,120],[28,122],[24,120],[20,110],[16,108],[12,108],[8,98],[4,100],[0,104],[-4,105],[-8,115],[-4,120],[0,116],[4,104],[8,100],[12,100],[16,100],[20,95],[24,92],[28,78],[26,72],[22,68],[20,58],[16,42],[12,44],[16,44],[22,37],[30,30],[36,28]],
      ];

      continentPaths.forEach((path) => {
        ctx.beginPath();
        let hasVisible = false;
        let first = true;
        path.forEach(([lat, lon]) => {
          const p = project(lat, lon, R * 1.001, cx, cy);
          if (!p.visible) return;
          if (first) { ctx.moveTo(p.sx, p.sy); first = false; }
          else        { ctx.lineTo(p.sx, p.sy); }
          hasVisible = true;
        });
        if (!hasVisible) return;
        ctx.strokeStyle = "rgba(0,220,180,0.28)";
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.fillStyle = "rgba(0,200,160,0.04)";
        ctx.fill();
      });

      // Inner atmosphere overlay
      const innerAtm = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.5, cx, cy, R);
      innerAtm.addColorStop(0,   "rgba(80,200,255,0.03)");
      innerAtm.addColorStop(0.7, "transparent");
      innerAtm.addColorStop(1,   "rgba(0,10,40,0.45)");
      ctx.beginPath(); safeArc(ctx, cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = innerAtm; ctx.fill();

      ctx.restore(); // end globe clip

      // Data arcs
      s.arcs.forEach((arc) => {
        arc.progress += arc.speed;
        if (arc.progress >= 1) {
          arc.progress = 0;
          const a = US_NODES[Math.floor(Math.random() * US_NODES.length)];
          let b = US_NODES[Math.floor(Math.random() * US_NODES.length)];
          while (b === a) b = US_NODES[Math.floor(Math.random() * US_NODES.length)];
          arc.lat1 = a.lat; arc.lon1 = a.lon; arc.lat2 = b.lat; arc.lon2 = b.lon;
          arc.colorIdx = Math.floor(Math.random() * ARC_PALETTE.length);
        }
        const head = Math.floor(arc.progress * STEPS);
        const [cr, cg, cb] = ARC_PALETTE[arc.colorIdx];

        for (let si = Math.max(0, head - TAIL); si < head; si++) {
          const f0 = si / STEPS, f1 = (si + 1) / STEPS;
          const p0 = project(arc.lat1 + (arc.lat2 - arc.lat1) * f0, arc.lon1 + (arc.lon2 - arc.lon1) * f0, R * 1.018, cx, cy);
          const p1 = project(arc.lat1 + (arc.lat2 - arc.lat1) * f1, arc.lon1 + (arc.lon2 - arc.lon1) * f1, R * 1.018, cx, cy);
          if (!p0.visible || !p1.visible || p0.z < -0.1 || p1.z < -0.1) continue;
          const age = (si - (head - TAIL)) / TAIL;
          const alpha = age * Math.max(0, p0.z + 0.5);
          ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy);
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha.toFixed(2)})`;
          ctx.lineWidth = 1.5 + age * 0.7;
          ctx.stroke();

          // Arc head glow
          if (si === head - 1) {
            ctx.beginPath();
            safeArc(ctx, p1.sx, p1.sy, 4, 0, Math.PI * 2);
            const hg = ctx.createRadialGradient(p1.sx, p1.sy, 0, p1.sx, p1.sy, 4);
            hg.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
            hg.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
            ctx.fillStyle = hg; ctx.fill();

            ctx.beginPath();
            safeArc(ctx, p1.sx, p1.sy, 8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${cr},${cg},${cb},0.10)`; ctx.fill();
          }
        }
      });

      // City nodes
      US_NODES.forEach(({ lat, lon, label }) => {
        const p = project(lat, lon, R, cx, cy);
        if (!p.visible || p.z < -0.05) return;
        const depth  = Math.max(0, (p.z + 1) / 2);
        const pulse  = 0.4 + 0.6 * Math.sin(t * 2.2 + lat * 0.4 + lon * 0.05);

        // Outer ring
        const r1 = Math.max(0, 11 * pulse * depth);
        if (r1 > 0) {
          ctx.beginPath();
          safeArc(ctx, p.sx, p.sy, r1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,255,180,${0.06 * pulse * depth})`; ctx.fill();
        }

        // Mid ring
        const r2 = Math.max(0, 5.5 * depth);
        if (r2 > 0) {
          ctx.beginPath();
          safeArc(ctx, p.sx, p.sy, r2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(80,200,255,${0.20 * depth})`; ctx.fill();
        }

        // Core dot
        const r3 = Math.max(0, 2.8 * depth);
        if (r3 > 0) {
          ctx.beginPath();
          safeArc(ctx, p.sx, p.sy, r3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,255,180,${0.95 * depth})`; ctx.fill();
        }

        // Center pixel
        ctx.beginPath();
        safeArc(ctx, p.sx, p.sy, 1.1, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff"; ctx.fill();

        if (depth > 0.45) {
          ctx.font = `700 10px "Share Tech Mono", monospace`;
          ctx.fillStyle = `rgba(220,255,245,${depth * 0.9})`;
          ctx.fillText(label, p.sx + 6, p.sy - 5);
        }
      });

      // Specular shine
      const shine = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.42, 0, cx - R * 0.15, cy - R * 0.15, R * 0.85);
      shine.addColorStop(0,   "rgba(180,240,255,0.20)");
      shine.addColorStop(0.2, "rgba(100,200,255,0.10)");
      shine.addColorStop(0.5, "rgba(50,120,255,0.04)");
      shine.addColorStop(1,   "transparent");
      ctx.beginPath(); safeArc(ctx, cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = shine; ctx.fill();

      // Lens flare
      const flare = ctx.createRadialGradient(cx - R * 0.41, cy - R * 0.40, 0, cx - R * 0.41, cy - R * 0.40, R * 0.16);
      flare.addColorStop(0,   "rgba(255,255,255,0.16)");
      flare.addColorStop(0.4, "rgba(180,240,255,0.05)");
      flare.addColorStop(1,   "transparent");
      ctx.beginPath(); safeArc(ctx, cx - R * 0.41, cy - R * 0.40, R * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = flare; ctx.fill();

      // Edge darkening
      const edge = ctx.createRadialGradient(cx, cy, R * 0.60, cx, cy, R);
      edge.addColorStop(0, "transparent");
      edge.addColorStop(1, "rgba(0,4,18,0.80)");
      ctx.beginPath(); safeArc(ctx, cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = edge; ctx.fill();
    };

    s.raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(s.raf);
      ro.disconnect();
      canvas.removeEventListener("mousedown",  onMD);
      canvas.removeEventListener("mousemove",  onMM);
      canvas.removeEventListener("mouseup",    onUp);
      canvas.removeEventListener("mouseleave", onUp);
      canvas.removeEventListener("touchstart", onTS);
      canvas.removeEventListener("touchmove",  onTM);
      canvas.removeEventListener("touchend",   onUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", cursor: "grab" }}
    />
  );
}

// ─── Auth Page ────────────────────────────────────────────────────────────────
type AuthMode = "login" | "signup";

export default function AuthPage() {
  const [mode,     setMode]     = useState<AuthMode>("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [org,      setOrg]      = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");
  const [focused,  setFocused]  = useState("");
  const [mounted,  setMounted]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [timeStr,  setTimeStr]  = useState("");

  useEffect(() => {
    setMounted(true);
    const tick = () => {
      const d = new Date();
      setTimeStr(d.toUTCString().slice(5, 22) + " UTC");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

 

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!email || !password) { setError("All fields are required."); return; }
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      if (data?.user) {
        if (!data.user.email_confirmed_at) {
          setError("Please verify your email before signing in. Check your inbox.");
          return;
        }
        setSuccess("Access granted. Redirecting…");
        setTimeout(() => { window.location.href = "/dashboard"; }, 1500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg.includes("Invalid login credentials") ? "Invalid email or password." : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!email || !password || !fullName) { setError("Name, email and password are required."); return; }
    if (password.length < 6)              { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { full_name: fullName, organization: org || "Not specified" },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (err) throw err;
      if (data?.user) {
        setSuccess("Account created! Check your email to confirm your address, then sign in.");
        setEmail(""); setPassword(""); setFullName(""); setOrg("");
        setTimeout(() => { setMode("login"); setSuccess(""); }, 5000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Signup failed";
      setError(msg.includes("User already registered") ? "This email is already registered. Sign in instead." : msg);
    } finally {
      setLoading(false);
    }
  };

  const inp = (field: string): React.CSSProperties => ({
    width: "100%",
    padding: "13px 16px",
    background: focused === field ? "rgba(0,200,160,0.12)" : "rgba(255,255,255,0.05)",
    border: `1.5px solid ${focused === field ? "rgba(0,255,180,0.75)" : "rgba(0,255,180,0.18)"}`,
    borderRadius: 8,
    color: "#F0F8FF",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 14,
    letterSpacing: 0.5,
    outline: "none",
    transition: "all 0.2s ease",
    boxShadow: focused === field
      ? "0 0 0 3px rgba(0,255,180,0.12), inset 0 0 14px rgba(0,200,160,0.07)"
      : "none",
  });

  const lbl: React.CSSProperties = {
    display: "block",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11, letterSpacing: 2,
    textTransform: "uppercase",
    color: "#5BBFFF", marginBottom: 8,
    fontWeight: 600,
  };

  return (
    <div style={{
      fontFamily: "'Rajdhani', sans-serif",
      background: "#050810",
      minHeight: "100vh",
      display: "flex",
      overflow: "hidden",
      position: "relative",
      color: "#E8F4FF",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&family=Orbitron:wght@400;600;700;900&family=Share+Tech+Mono&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(0,255,180,0.25);border-radius:2px;}
        input::placeholder{color:rgba(130,200,180,0.45)!important;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.25}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes spinRev{to{transform:rotate(-360deg)}}
        @keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}}
        @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
        @keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
        .tab-btn{transition:all 0.25s ease;}
        .tab-btn:hover{color:rgba(0,255,180,1)!important;}
        .submit-btn{transition:transform 0.18s ease,box-shadow 0.18s ease,opacity 0.18s;}
        .submit-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 44px rgba(0,210,160,0.50)!important;}
        .submit-btn:active:not(:disabled){transform:translateY(0);}
        .chip{transition:all 0.2s;cursor:default;}
        .chip:hover{background:rgba(0,255,180,0.14)!important;color:rgba(0,255,180,1)!important;border-color:rgba(0,255,180,0.4)!important;}
      `}</style>

      {/* LEFT: Globe Panel */}
      <div style={{
        flex: "1 1 58%",
        position: "relative",
        overflow: "hidden",
        background: "radial-gradient(ellipse at 55% 50%, rgba(0,20,40,0.95) 0%, #050810 72%)",
        minWidth: 0,
      }}>
        <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
          <Globe />
        </div>

        <div style={{
          position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
          background: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.018) 3px,rgba(0,0,0,0.018) 4px)",
        }} />

        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "3px",
          background: "linear-gradient(180deg,transparent,rgba(0,255,180,0.06),transparent)",
          zIndex: 3, pointerEvents: "none",
          animation: "scanline 6s linear infinite",
        }} />

        {/* Top bar */}
        <div style={{
          position: "relative", zIndex: 10,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 28px",
          borderBottom: "1px solid rgba(0,255,180,0.10)",
          background: "linear-gradient(180deg,rgba(5,8,16,0.97) 0%,transparent 100%)",
          backdropFilter: "blur(8px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative", width: 46, height: 46, animation: "floatY 4s ease-in-out infinite" }}>
              <div style={{
                position: "absolute", inset: 0,
                border: "2px solid transparent",
                borderTopColor: "#00FFB4", borderRightColor: "rgba(0,255,180,0.25)",
                borderRadius: "50%", animation: "spin 2.8s linear infinite",
              }} />
              <div style={{
                position: "absolute", inset: 7,
                border: "1.5px solid transparent",
                borderBottomColor: "#4DA8FF", borderLeftColor: "rgba(77,168,255,0.25)",
                borderRadius: "50%", animation: "spinRev 2s linear infinite",
              }} />
              <div style={{
                position: "absolute", inset: 14,
                border: "1px solid rgba(160,80,255,0.5)",
                borderRadius: "50%",
              }} />
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 900, color: "#00FFB4",
              }}>FRI</div>
            </div>
            <div>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 700,
                color: "#F0F8FF", letterSpacing: 0.5,
              }}>Food Resilience Dashboard</div>
              <div style={{
                fontFamily: "'Share Tech Mono',monospace", fontSize: 9,
                color: "rgba(0,255,180,0.50)", letterSpacing: 2, marginTop: 2,
              }}>INTELLIGENCE PLATFORM · USA</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontFamily: "'Share Tech Mono',monospace", fontSize: 10,
              color: "rgba(100,190,255,0.75)", letterSpacing: 1,
            }}>{timeStr}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end", marginTop: 4 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#00FFB4", display: "inline-block",
                animation: "blink 1.6s infinite",
                boxShadow: "0 0 8px rgba(0,255,180,1)",
              }} />
              <span style={{
                fontFamily: "'Share Tech Mono',monospace", fontSize: 9,
                color: "#00FFB4", letterSpacing: 2,
              }}>LIVE · 50 STATES</span>
            </div>
          </div>
        </div>

        <div style={{
          position: "absolute", top: "50%", right: 18, zIndex: 5,
          transform: "translateY(-50%)",
          fontFamily: "'Share Tech Mono',monospace", fontSize: 8,
          color: "rgba(0,255,180,0.35)", letterSpacing: 2.5,
          writingMode: "vertical-rl",
          animation: "pulse 3s ease-in-out infinite",
        }}>DRAG · ROTATE</div>

        {/* Bottom overlay */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10,
          padding: "80px 36px 32px",
          background: "linear-gradient(0deg,rgba(5,8,16,0.98) 0%,rgba(5,8,16,0.70) 50%,transparent 100%)",
        }}>
          <div style={{
            fontFamily: "'Share Tech Mono',monospace", fontSize: 9,
            letterSpacing: 3, color: "rgba(0,255,180,0.55)", marginBottom: 12,
            textShadow: "0 0 12px rgba(0,255,180,0.4)",
          }}>◈ MULTIDIMENSIONAL RESILIENCE ENGINE</div>

          <h2 style={{
            fontFamily: "'Orbitron',sans-serif",
            fontSize: "clamp(20px,2.4vw,32px)",
            fontWeight: 900, lineHeight: 1.3,
            marginBottom: 14,
            textShadow: "0 2px 20px rgba(0,0,0,0.8)",
          }}>
            <span style={{ color: "#F0F8FF" }}>Transforming Federal</span><br />
            <span style={{
              background: "linear-gradient(90deg,#00FFB4,#4DA8FF,#A050FF,#00FFB4)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "shimmer 4s linear infinite",
              filter: "drop-shadow(0 0 8px rgba(0,255,180,0.3))",
            }}>Longitudinal Data</span><br />
            <span style={{ color: "#F0F8FF" }}>Into Resilience Indices.</span>
          </h2>

          <p style={{
            fontSize: 15, lineHeight: 1.75,
            color: "rgba(200,230,245,0.85)", maxWidth: 440, fontWeight: 500,
            textShadow: "0 1px 8px rgba(0,0,0,0.9)",
          }}>
            Real-time weighted indexing across all 50 US states.
          </p>

          <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
            {["USDA FEEDS","HHS DATA","FEMA INDEX","WFP PIPELINE","FAO LIVE"].map((chip, i) => (
              <span key={i} className="chip" style={{
                padding: "5px 13px",
                border: "1px solid rgba(0,255,180,0.28)",
                borderRadius: 4,
                fontFamily: "'Share Tech Mono',monospace",
                fontSize: 9, letterSpacing: 1.5,
                color: "rgba(0,255,200,0.85)",
                background: "rgba(0,255,180,0.06)",
                animation: `pulse 3s ease-in-out ${i * 0.45}s infinite`,
                textShadow: "0 0 8px rgba(0,255,180,0.3)",
              }}>{chip}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{
        width: 1, flexShrink: 0,
        background: "linear-gradient(180deg,transparent,rgba(0,255,180,0.25) 28%,rgba(77,168,255,0.32) 50%,rgba(0,255,180,0.25) 72%,transparent)",
      }} />

      {/* RIGHT: Auth Panel */}
             <div style={{
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px 28px",
  overflowY: "auto",
  minHeight: "100vh",
}}>
  <AuthForm />
</div>

    </div>
  );
}