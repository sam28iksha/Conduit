"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── TYPES ─────────────────────────────────────────────────────────────────
type Theme = "dark" | "light";
type Page = "home" | "overview" | "incidents" | "reasoning" | "evaluations" | "traces" | "connectors" | "settings";

interface StreamEvent {
  type: "start" | "text" | "tool_call" | "tool_result" | "eval" | "done" | "heartbeat";
  content?: string;
  tool?: string;
  scores?: Record<string, any>;
  message?: string;
  session_id?: string;
}

interface Incident {
  incident_id: string;
  overall_score: number;
  diagnosis_accuracy?: number;
  action_appropriateness?: number;
  reasoning_clarity?: number;
  escalation_judgment?: number;
  key_finding?: string;
  improvement_suggestion?: string;
  error?: string;
}

interface HealthData {
  average_score: number;
  total_runs: number;
  recent_scores: number[];
}

// ─── MOCK DATA for rich demo ───────────────────────────────────────────────
const MOCK_CONNECTORS = [
  { id: "salesforce_prod", service: "Salesforce", health: "degraded", lastSync: "2m ago", issue: "Schema drift on Opportunity", severity: "high", syncFreq: "6h", recommendation: "Trigger resync after schema validation" },
  { id: "stripe_payments", service: "Stripe", health: "error", lastSync: "18m ago", issue: "Rate limit 429", severity: "medium", syncFreq: "3h", recommendation: "Exponential backoff, retry in 5min" },
  { id: "postgres_analytics", service: "PostgreSQL", health: "critical", lastSync: "2h ago", issue: "Auth credentials expired", severity: "critical", syncFreq: "24h", recommendation: "Human intervention required" },
  { id: "hubspot_crm", service: "HubSpot", health: "healthy", lastSync: "12m ago", issue: null, severity: "none", syncFreq: "1h", recommendation: "Operating normally" },
  { id: "bigquery_warehouse", service: "BigQuery", health: "healthy", lastSync: "5m ago", issue: null, severity: "none", syncFreq: "30m", recommendation: "Operating normally" },
];

// ─── UTILS ─────────────────────────────────────────────────────────────────
const scoreColor = (s: number) =>
  s >= 4.5 ? "#22c55e" : s >= 3.5 ? "#84cc16" : s >= 2.5 ? "#f59e0b" : "#ef4444";

const healthColor = (h: string) => ({
  healthy: "#22c55e", degraded: "#f59e0b",
  error: "#f97316", critical: "#ef4444",
}[h] || "#6b7280");

const severityBg = (s: string) => ({
  critical: "rgba(239,68,68,0.15)", high: "rgba(249,115,22,0.15)",
  medium: "rgba(245,158,11,0.15)", none: "rgba(34,197,94,0.1)",
}[s] || "rgba(107,114,128,0.1)");

const severityText = (s: string) => ({
  critical: "#ef4444", high: "#f97316", medium: "#f59e0b", none: "#22c55e",
}[s] || "#6b7280");

function SparkLine({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 5);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 80, h = 28;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(((data.length - 1) / (data.length - 1)) * w)} cy={h - ((data[data.length - 1] - min) / range) * h} r="2.5" fill={color} />
    </svg>
  );
}

function PulsingDot({ color }: { color: string }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ backgroundColor: color }} />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: color }} />
    </span>
  );
}

function RadarChart({ scores }: { scores: Record<string, number> }) {
  const dims = ["diagnosis_accuracy", "action_appropriateness", "reasoning_clarity", "escalation_judgment"];
  const labels = ["Diagnosis", "Action", "Clarity", "Judgment"];
  const cx = 80, cy = 80, r = 60;
  const angles = dims.map((_, i) => (i / dims.length) * 2 * Math.PI - Math.PI / 2);
  const pts = dims.map((d, i) => {
    const v = (scores[d] || 0) / 5;
    return `${cx + Math.cos(angles[i]) * r * v},${cy + Math.sin(angles[i]) * r * v}`;
  }).join(" ");
  const gridPts = (frac: number) => dims.map((_, i) =>
    `${cx + Math.cos(angles[i]) * r * frac},${cy + Math.sin(angles[i]) * r * frac}`
  ).join(" ");
  return (
    <svg width={160} height={160}>
      {[0.25, 0.5, 0.75, 1].map(f => (
        <polygon key={f} points={gridPts(f)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      <polygon points={pts} fill="rgba(34,197,94,0.2)" stroke="#22c55e" strokeWidth="1.5" />
      {dims.map((d, i) => {
        const v = (scores[d] || 0) / 5;
        return <circle key={i} cx={cx + Math.cos(angles[i]) * r * v} cy={cy + Math.sin(angles[i]) * r * v} r="3" fill="#22c55e" />;
      })}
      {labels.map((l, i) => (
        <text key={i} x={cx + Math.cos(angles[i]) * (r + 14)} y={cy + Math.sin(angles[i]) * (r + 14)} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="rgba(255,255,255,0.5)">{l}</text>
      ))}
    </svg>
  );
}

// ─── SIDEBAR ───────────────────────────────────────────────────────────────
const NAV_ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "⬡" },
  { id: "incidents", label: "Incidents", icon: "⚡" },
  { id: "reasoning", label: "Live Reasoning", icon: "◎" },
  { id: "evaluations", label: "Evaluations", icon: "◈" },
  { id: "traces", label: "Traces", icon: "⋮" },
  { id: "connectors", label: "Connectors", icon: "⊞" },
  { id: "settings", label: "Settings", icon: "⊙" },
];

// ─── MAIN APP ──────────────────────────────────────────────────────────────
export default function ConduitApp() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [page, setPage] = useState<Page>("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [lastRunTime, setLastRunTime] = useState<number | null>(null);
  const esRef = useRef<EventSource | null>(null);



  const isDark = true;
  const css = {
    bg: "#040507",
    surface: "rgba(255, 255, 255, 0.03)",
    surface2: "rgba(255, 255, 255, 0.05)",
    border: "rgba(255, 255, 255, 0.08)",
    text: "#ffffff",
    textMuted: "rgba(255, 255, 255, 0.55)",
    accent: "#22c55e",
    accentBlue: "#3b82f6",
    accentAmber: "#f59e0b",
    accentRed: "#ef4444",
  };

  const fetchData = useCallback(async () => {
    try {
      const [inc, hlth] = await Promise.all([
        fetch(`${API}/incidents`).then(r => r.json()),
        fetch(`${API}/health/score`).then(r => r.json()),
      ]);
      setIncidents(inc.incidents || []);
      setHealth(hlth);
    } catch { /* backend may not be running */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAgent = async () => {
    if (running) return;
    setRunning(true);
    setStreamEvents([]);
    setPage("reasoning");
    const start = Date.now();
    try {
      const res = await fetch(`${API}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Check all pipeline connectors and report their current status." }),
      });
      const { session_id } = await res.json();
      const es = new EventSource(`${API}/stream/${session_id}`);
      esRef.current = es;
      es.onmessage = (e) => {
        const evt: StreamEvent = JSON.parse(e.data);
        if (evt.type === "done") {
          es.close();
          setRunning(false);
          setLastRunTime(Date.now() - start);
          fetchData();
          return;
        }
        if (evt.type !== "heartbeat") {
          setStreamEvents(prev => [...prev, evt]);
        }
      };
      es.onerror = () => { es.close(); setRunning(false); };
    } catch { setRunning(false); }
  };


  // ─── HOME ──────────────────────────────────────────────────────────────────
  const FrameSequence = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [images, setImages] = useState<HTMLImageElement[]>([]);
    const [loaded, setLoaded] = useState(false);
    const frameCount = 192;

    useEffect(() => {
      let isMounted = true;
      const preloadImages = () => {
        const loadedImages: HTMLImageElement[] = [];
        let loadedCount = 0;

        for (let i = 1; i <= frameCount; i++) {
          const img = new Image();
          img.src = `/frame/ezgif-frame-${String(i).padStart(3, '0')}.jpg`;
          img.onload = () => {
            loadedCount++;
            if (loadedCount === frameCount && isMounted) {
              setLoaded(true);
            }
          };
          img.onerror = () => {
            // In case some frames are missing, just count it loaded to not block forever
            loadedCount++;
            if (loadedCount === frameCount && isMounted) {
              setLoaded(true);
            }
          };
          loadedImages.push(img);
        }
        if (isMounted) {
          setImages(loadedImages);
        }
      };
      preloadImages();
      return () => { isMounted = false; };
    }, []);

    useEffect(() => {
      if (!loaded || !canvasRef.current || images.length === 0) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cw = images[0].width || 1280;
      const ch = images[0].height || 720;
      canvas.width = cw;
      canvas.height = ch;

      let frame = 0;
      let animationId: number;
      let lastTime = performance.now();
      const targetFps = 30; // 30fps
      const interval = 1000 / targetFps;

      const render = (time: number) => {
        animationId = requestAnimationFrame(render);
        const deltaTime = time - lastTime;

        if (deltaTime > interval) {
          lastTime = time - (deltaTime % interval);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (images[frame] && images[frame].width > 0) {
            ctx.drawImage(images[frame], 0, 0, canvas.width, canvas.height);
          }
          frame = (frame + 1) % frameCount;
        }
      };

      animationId = requestAnimationFrame(render);

      return () => cancelAnimationFrame(animationId);
    }, [loaded, images]);

    return (
      <>
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
            opacity: loaded ? 1 : 0,
            transition: 'opacity 1s ease-in-out'
          }}
        />
        {!loaded && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0b0e', zIndex: 1 }}>
            <div style={{ color: '#fff', fontFamily: "'DM Mono', monospace", opacity: 0.5, animation: 'pulse 1.5s infinite' }}>Loading Pipeline Stream...</div>
          </div>
        )}
      </>
    );
  };

  // ── OVERVIEW ──────────────────────────────────────────────────────────────
  const OverviewPage = () => {
    const healthyCount = MOCK_CONNECTORS.filter(c => c.health === "healthy").length;
    const failedCount = MOCK_CONNECTORS.filter(c => c.health !== "healthy").length;
    const avgScore = health?.average_score || 0;
    const totalRuns = health?.total_runs || 0;
    const recentScores = health?.recent_scores || [];
    const autoFixed = incidents.filter(i => i.overall_score >= 4).length;
    const escalated = incidents.filter(i => i.overall_score < 3).length;

    const metrics = [
      { label: "Healthy Connectors", value: `${healthyCount}/${MOCK_CONNECTORS.length}`, color: css.accent, icon: "✓", trend: "+0" },
      { label: "Failed Pipelines", value: failedCount, color: css.accentRed, icon: "✕", trend: "+2" },
      { label: "Auto-Resolved", value: autoFixed, color: css.accentBlue, icon: "⚡", trend: `+${autoFixed}` },
      { label: "Escalated", value: escalated, color: css.accentAmber, icon: "↑", trend: `${escalated}` },
      { label: "Avg AI Score", value: avgScore ? `${avgScore.toFixed(2)}/5` : "—", color: scoreColor(avgScore), icon: "◈", trend: "↑0.3" },
      { label: "Total Traces", value: totalRuns, color: "#a78bfa", icon: "⋮", trend: `+${totalRuns}` },
      { label: "Avg Recovery", value: lastRunTime ? `${(lastRunTime / 1000).toFixed(1)}s` : "—", color: "#67e8f9", icon: "◷", trend: "—" },
      { label: "Active Incidents", value: failedCount, color: css.accentRed, icon: "◉", trend: "" },
    ];

    return (
      <div>
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 600, color: css.text, letterSpacing: "-0.02em" }}>
            System Overview
          </h1>
          <p style={{ fontSize: "0.8125rem", color: css.textMuted, marginTop: "0.25rem" }}>
            Pipeline intelligence across all connected data sources
          </p>
        </div>

        {/* Metric cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {metrics.map((m, i) => (
            <div key={i} style={{
              background: css.surface, backdropFilter: 'blur(16px)', border: `1px solid ${css.border}`,
              borderRadius: "12px", padding: "1.125rem",
              transition: "transform 0.15s, box-shadow 0.15s",
              cursor: "default",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px rgba(0,0,0,0.25)`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.625rem" }}>
                <span style={{ fontSize: "0.6875rem", fontWeight: 500, color: css.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.label}</span>
                <span style={{ fontSize: "1rem", color: m.color, opacity: 0.8 }}>{m.icon}</span>
              </div>
              <div style={{ fontSize: "1.625rem", fontWeight: 700, color: m.color, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: "0.6875rem", color: css.textMuted, marginTop: "0.375rem" }}>{m.trend}</div>
            </div>
          ))}
        </div>

        {/* Score trend + Recent incidents side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
          {/* Score trend */}
          <div style={{ background: css.surface, backdropFilter: 'blur(16px)', border: `1px solid ${css.border}`, borderRadius: "12px", padding: "1.25rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 500, color: css.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "1rem" }}>AI Score Trend</div>
            {recentScores.length > 1 ? (
              <div style={{ display: "flex", alignItems: "flex-end", gap: "0.375rem", height: "60px" }}>
                {recentScores.map((s, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: "4px" }}>
                    <div style={{ width: "100%", height: `${(s / 5) * 48}px`, borderRadius: "3px 3px 0 0", background: scoreColor(s), opacity: i === recentScores.length - 1 ? 1 : 0.5, transition: "height 0.5s ease" }} />
                    <span style={{ fontSize: "0.6rem", color: css.textMuted }}>{s}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: css.textMuted, fontSize: "0.8125rem" }}>Run the agent to see trends</div>
            )}
          </div>

          {/* Recent incidents */}
          <div style={{ background: css.surface, backdropFilter: 'blur(16px)', border: `1px solid ${css.border}`, borderRadius: "12px", padding: "1.25rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 500, color: css.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.875rem" }}>Recent Incidents</div>
            {incidents.length === 0 ? (
              <div style={{ color: css.textMuted, fontSize: "0.8125rem" }}>No incidents recorded yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {incidents.slice(0, 4).map((inc, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0.75rem", background: css.surface2, backdropFilter: 'blur(8px)', borderRadius: "8px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: scoreColor(inc.overall_score), flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: "0.75rem", color: css.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {inc.key_finding?.slice(0, 55) || "Incident analyzed"}...
                    </div>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: scoreColor(inc.overall_score), fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{inc.overall_score}/5</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Connector health strip */}
        <div style={{ background: css.surface, backdropFilter: 'blur(16px)', border: `1px solid ${css.border}`, borderRadius: "12px", padding: "1.25rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 500, color: css.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.875rem" }}>Connector Health</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {MOCK_CONNECTORS.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: healthColor(c.health), flexShrink: 0 }} />
                <div style={{ width: "120px", fontSize: "0.8125rem", fontWeight: 500, color: css.text }}>{c.service}</div>
                <div style={{ flex: 1, height: "4px", background: css.surface2, backdropFilter: 'blur(8px)', borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: c.health === "healthy" ? "100%" : c.health === "degraded" ? "60%" : c.health === "error" ? "30%" : "10%", background: healthColor(c.health), borderRadius: "2px", transition: "width 1s ease" }} />
                </div>
                <div style={{ fontSize: "0.6875rem", color: css.textMuted, width: "80px", textAlign: "right" }}>{c.issue || "Healthy"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── INCIDENTS ─────────────────────────────────────────────────────────────
  const IncidentsPage = () => {
    const [filter, setFilter] = useState("all");
    const [expanded, setExpanded] = useState<string | null>(null);

    const filtered = incidents.filter(inc => {
      if (filter === "high") return inc.overall_score <= 3;
      if (filter === "resolved") return inc.overall_score >= 4;
      return true;
    });

    const statusLabel = (score: number) => {
      if (score >= 5) return { label: "AUTO-RESOLVED", color: css.accent };
      if (score >= 4) return { label: "RESOLVED", color: "#84cc16" };
      if (score >= 3) return { label: "INVESTIGATING", color: css.accentAmber };
      if (score >= 2) return { label: "ESCALATED", color: css.accentRed };
      return { label: "FAILED", color: "#9ca3af" };
    };

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.375rem", fontWeight: 600, color: css.text, letterSpacing: "-0.02em" }}>Incidents</h1>
            <p style={{ fontSize: "0.8125rem", color: css.textMuted, marginTop: "0.25rem" }}>{incidents.length} total incidents recorded</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {["all", "high", "resolved"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "0.375rem 0.875rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 500,
                background: filter === f ? css.accent : css.surface2,
                color: filter === f ? "#000" : css.textMuted,
                border: `1px solid ${filter === f ? css.accent : css.border}`,
                cursor: "pointer", transition: "all 0.15s",
              }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ background: css.surface, backdropFilter: 'blur(16px)', border: `1px solid ${css.border}`, borderRadius: "12px", padding: "3rem", textAlign: "center", color: css.textMuted }}>
            No incidents yet. Run a pipeline check to see results.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {filtered.map((inc, i) => {
              const st = statusLabel(inc.overall_score);
              const isOpen = expanded === inc.incident_id;
              return (
                <div key={i} style={{ background: css.surface, backdropFilter: 'blur(16px)', border: `1px solid ${css.border}`, borderRadius: "12px", overflow: "hidden", transition: "border-color 0.15s" }}>
                  <div style={{ padding: "1rem 1.25rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "1rem" }}
                    onClick={() => setExpanded(isOpen ? null : inc.incident_id)}>
                    <PulsingDot color={st.color} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.25rem" }}>
                        <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.5rem", borderRadius: "4px", background: `${st.color}22`, color: st.color, letterSpacing: "0.05em" }}>{st.label}</span>
                        <span style={{ fontSize: "0.6875rem", color: css.textMuted, fontFamily: "'DM Mono', monospace" }}>#{inc.incident_id.slice(0, 8)}</span>
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: css.text, lineHeight: 1.4 }}>{inc.key_finding?.slice(0, 100) || "Incident analyzed"}...</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: scoreColor(inc.overall_score), fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{inc.overall_score}<span style={{ fontSize: "0.875rem", opacity: 0.5 }}>/5</span></div>
                      <div style={{ fontSize: "0.6875rem", color: css.textMuted }}>AI score</div>
                    </div>
                    <span style={{ color: css.textMuted, fontSize: "0.875rem", marginLeft: "0.25rem" }}>{isOpen ? "↑" : "↓"}</span>
                  </div>
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${css.border}`, padding: "1.25rem", background: css.surface2 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <div>
                          <div style={{ fontSize: "0.6875rem", color: css.textMuted, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Evaluator Breakdown</div>
                          {["diagnosis_accuracy", "action_appropriateness", "reasoning_clarity", "escalation_judgment"].map(dim => (
                            <div key={dim} style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.5rem" }}>
                              <span style={{ fontSize: "0.6875rem", color: css.textMuted, width: "120px", textTransform: "capitalize" }}>{dim.replace(/_/g, " ")}</span>
                              <div style={{ flex: 1, height: "4px", background: css.border, borderRadius: "2px" }}>
                                <div style={{ height: "100%", width: `${((inc as any)[dim] || 0) / 5 * 100}%`, background: scoreColor((inc as any)[dim] || 0), borderRadius: "2px" }} />
                              </div>
                              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: scoreColor((inc as any)[dim] || 0), fontFamily: "'DM Mono', monospace", width: "24px", textAlign: "right" }}>{(inc as any)[dim] || 0}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div style={{ fontSize: "0.6875rem", color: css.textMuted, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Improvement</div>
                          <p style={{ fontSize: "0.8125rem", color: css.text, lineHeight: 1.6 }}>{inc.improvement_suggestion || "No suggestions"}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── LIVE REASONING ────────────────────────────────────────────────────────
  const ReasoningPage = () => {
    const bottomRef = useRef<HTMLDivElement>(null);
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [streamEvents]);

    const eventIcon = (type: string) => ({
      start: "◎", tool_call: "→", tool_result: "←", text: "◉", eval: "◈",
    }[type] || "·");

    const eventColor = (type: string) => ({
      start: css.accentBlue, tool_call: "#67e8f9", tool_result: "rgba(103,232,249,0.5)",
      text: css.text, eval: css.accent,
    }[type] || css.textMuted);

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.375rem", fontWeight: 600, color: css.text, letterSpacing: "-0.02em" }}>Live Reasoning</h1>
            <p style={{ fontSize: "0.8125rem", color: css.textMuted, marginTop: "0.25rem" }}>Real-time agent decision stream</p>
          </div>
          <button onClick={runAgent} disabled={running} style={{
            padding: "0.5rem 1.25rem", borderRadius: "8px", fontSize: "0.8125rem", fontWeight: 600,
            background: running ? css.surface2 : css.accent,
            color: running ? css.textMuted : "#000",
            border: `1px solid ${running ? css.border : css.accent}`,
            cursor: running ? "not-allowed" : "pointer", transition: "all 0.15s",
            display: "flex", alignItems: "center", gap: "0.5rem",
          }}>
            {running && <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◎</span>}
            {running ? "Agent running..." : "▶ Run pipeline check"}
          </button>
        </div>

        <div style={{
          background: css.surface, backdropFilter: 'blur(16px)', border: `1px solid ${css.border}`, borderRadius: "12px",
          padding: "1.25rem", minHeight: "400px", maxHeight: "65vh", overflowY: "auto",
          fontFamily: "'DM Mono', monospace",
        }}>
          {streamEvents.length === 0 && !running ? (
            <div style={{ color: css.textMuted, fontSize: "0.8125rem", textAlign: "center", paddingTop: "3rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "1rem", opacity: 0.3 }}>◎</div>
              Click "Run pipeline check" to see live agent reasoning
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {streamEvents.map((evt, i) => (
                <div key={i} style={{
                  display: "flex", gap: "0.875rem", alignItems: "flex-start",
                  animation: "fadeIn 0.3s ease",
                  padding: "0.375rem 0",
                  borderBottom: evt.type === "eval" ? `1px solid ${css.border}` : "none",
                }}>
                  <span style={{ color: eventColor(evt.type), fontSize: "0.75rem", marginTop: "2px", flexShrink: 0, width: "12px" }}>{eventIcon(evt.type)}</span>
                  <div style={{ flex: 1 }}>
                    {evt.type === "tool_call" && (
                      <span style={{ fontSize: "0.8125rem", color: "#67e8f9" }}>Calling <strong>{evt.tool}</strong>()</span>
                    )}
                    {evt.type === "tool_result" && (
                      <span style={{ fontSize: "0.8125rem", color: "rgba(103,232,249,0.5)" }}>{evt.tool} returned data</span>
                    )}
                    {evt.type === "text" && (
                      <span style={{ fontSize: "0.8125rem", color: css.text, lineHeight: 1.6 }}>{evt.content}</span>
                    )}
                    {evt.type === "start" && (
                      <span style={{ fontSize: "0.8125rem", color: css.accentBlue }}>Agent session started</span>
                    )}
                    {evt.type === "eval" && evt.scores && (
                      <div style={{ background: css.surface2, backdropFilter: 'blur(8px)', borderRadius: "8px", padding: "0.75rem 1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.375rem" }}>
                          <span style={{ fontSize: "0.75rem", color: css.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Eval complete</span>
                          <span style={{ fontSize: "1.125rem", fontWeight: 700, color: scoreColor(evt.scores.overall_score as number) }}>{evt.scores.overall_score as number}/5</span>
                        </div>
                        <p style={{ fontSize: "0.8125rem", color: css.text, lineHeight: 1.5 }}>{evt.scores.key_finding as string}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {running && (
                <div style={{ display: "flex", gap: "0.5rem", padding: "0.5rem 0" }}>
                  {[0, 1, 2].map(j => (
                    <div key={j} style={{ width: "5px", height: "5px", borderRadius: "50%", background: css.accent, animation: `pulse 1.2s ${j * 0.2}s infinite` }} />
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── EVALUATIONS ───────────────────────────────────────────────────────────
  const EvaluationsPage = () => {
    const avgScore = health?.average_score || 0;
    const latest = incidents[0];
    const scoreDistribution = [1, 2, 3, 4, 5].map(s => ({
      score: s,
      count: incidents.filter(i => Math.round(i.overall_score) === s).length,
    }));
    const maxCount = Math.max(...scoreDistribution.map(d => d.count), 1);

    return (
      <div>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 600, color: css.text, letterSpacing: "-0.02em" }}>Evaluations</h1>
          <p style={{ fontSize: "0.8125rem", color: css.textMuted, marginTop: "0.25rem" }}>LLM-as-a-Judge quality metrics</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
          {[
            { label: "Avg Score", value: avgScore ? avgScore.toFixed(2) : "—", color: scoreColor(avgScore) },
            { label: "Total Evaluated", value: incidents.length, color: css.accentBlue },
            { label: "Top Score", value: incidents.length ? Math.max(...incidents.map(i => i.overall_score)) + "/5" : "—", color: css.accent },
          ].map((m, i) => (
            <div key={i} style={{ background: css.surface, backdropFilter: 'blur(16px)', border: `1px solid ${css.border}`, borderRadius: "12px", padding: "1.25rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.6875rem", color: css.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>{m.label}</div>
              <div style={{ fontSize: "2rem", fontWeight: 700, color: m.color, fontFamily: "'DM Mono', monospace" }}>{m.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
          {/* Radar chart */}
          {latest && (
            <div style={{ background: css.surface, backdropFilter: 'blur(16px)', border: `1px solid ${css.border}`, borderRadius: "12px", padding: "1.25rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontSize: "0.6875rem", color: css.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>Latest Run</div>
              <RadarChart scores={latest as any} />
            </div>
          )}

          {/* Score distribution */}
          <div style={{ background: css.surface, backdropFilter: 'blur(16px)', border: `1px solid ${css.border}`, borderRadius: "12px", padding: "1.25rem" }}>
            <div style={{ fontSize: "0.6875rem", color: css.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "1rem" }}>Score Distribution</div>
            {scoreDistribution.map(d => (
              <div key={d.score} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.625rem" }}>
                <span style={{ fontSize: "0.75rem", fontFamily: "'DM Mono', monospace", color: scoreColor(d.score), width: "16px" }}>{d.score}</span>
                <div style={{ flex: 1, height: "8px", background: css.surface2, backdropFilter: 'blur(8px)', borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(d.count / maxCount) * 100}%`, background: scoreColor(d.score), borderRadius: "4px", transition: "width 0.8s ease" }} />
                </div>
                <span style={{ fontSize: "0.75rem", color: css.textMuted, width: "20px", textAlign: "right" }}>{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent evaluations list */}
        <div style={{ background: css.surface, backdropFilter: 'blur(16px)', border: `1px solid ${css.border}`, borderRadius: "12px", padding: "1.25rem" }}>
          <div style={{ fontSize: "0.6875rem", color: css.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.875rem" }}>Evaluation Log</div>
          {incidents.length === 0 ? (
            <div style={{ color: css.textMuted, fontSize: "0.8125rem" }}>No evaluations yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {incidents.slice(0, 8).map((inc, i) => (
                <div key={i} style={{ display: "flex", gap: "0.875rem", padding: "0.625rem 0.875rem", background: css.surface2, backdropFilter: 'blur(8px)', borderRadius: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${scoreColor(inc.overall_score)}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: scoreColor(inc.overall_score), fontFamily: "'DM Mono', monospace" }}>{inc.overall_score}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "0.8125rem", color: css.text, marginBottom: "0.25rem" }}>{inc.key_finding?.slice(0, 90) || "Analyzed"}...</p>
                    <p style={{ fontSize: "0.6875rem", color: css.textMuted }}>{inc.improvement_suggestion?.slice(0, 70) || ""}...</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── TRACES ────────────────────────────────────────────────────────────────
  const TracesPage = () => (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.375rem", fontWeight: 600, color: css.text, letterSpacing: "-0.02em" }}>Phoenix Traces</h1>
        <p style={{ fontSize: "0.8125rem", color: css.textMuted, marginTop: "0.25rem" }}>Full observability via Arize Phoenix</p>
      </div>
      <div style={{ background: css.surface, backdropFilter: 'blur(16px)', border: `1px solid ${css.border}`, borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${css.border}`, display: "flex", gap: "0.875rem", alignItems: "center" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: css.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", flex: 2 }}>Trace</div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: css.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", flex: 1 }}>Tools</div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: css.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", width: "80px", textAlign: "right" }}>Score</div>
        </div>
        {incidents.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: css.textMuted, fontSize: "0.8125rem" }}>No traces yet. Run the agent to generate traces.</div>
        ) : incidents.map((inc, i) => (
          <div key={i} style={{ padding: "0.875rem 1.25rem", borderBottom: i < incidents.length - 1 ? `1px solid ${css.border}` : "none", display: "flex", gap: "0.875rem", alignItems: "center" }}>
            <div style={{ flex: 2 }}>
              <div style={{ fontSize: "0.75rem", fontFamily: "'DM Mono', monospace", color: css.accentBlue, marginBottom: "0.2rem" }}>{inc.incident_id}</div>
              <div style={{ fontSize: "0.6875rem", color: css.textMuted }}>Conduit agent run</div>
            </div>
            <div style={{ flex: 1, display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
              {["list_connectors", "get_details"].map(t => (
                <span key={t} style={{ fontSize: "0.5875rem", padding: "0.125rem 0.375rem", borderRadius: "4px", background: "rgba(103,232,249,0.1)", color: "#67e8f9", fontFamily: "'DM Mono', monospace" }}>{t}</span>
              ))}
            </div>
            <div style={{ width: "80px", textAlign: "right" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: scoreColor(inc.overall_score), fontFamily: "'DM Mono', monospace" }}>{inc.overall_score}/5</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "1rem", padding: "0.875rem 1.25rem", background: css.surface, backdropFilter: 'blur(16px)', border: `1px solid ${css.border}`, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.8125rem", color: css.textMuted }}>Full trace details available in Phoenix Cloud</span>
        <a href="https://app.phoenix.arize.com" target="_blank" rel="noreferrer" style={{ fontSize: "0.8125rem", color: css.accentBlue, textDecoration: "none", fontWeight: 500 }}>Open Phoenix →</a>
      </div>
    </div>
  );

  // ── CONNECTORS ────────────────────────────────────────────────────────────
  const ConnectorsPage = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 600, color: css.text, letterSpacing: "-0.02em" }}>Connectors</h1>
          <p style={{ fontSize: "0.8125rem", color: css.textMuted, marginTop: "0.25rem" }}>Fivetran data pipeline status</p>
        </div>
        <button onClick={runAgent} disabled={running} style={{
          padding: "0.5rem 1.25rem", borderRadius: "8px", fontSize: "0.8125rem", fontWeight: 600,
          background: running ? css.surface2 : css.accent, color: running ? css.textMuted : "#000",
          border: `1px solid ${running ? css.border : css.accent}`, cursor: running ? "not-allowed" : "pointer",
        }}>{running ? "Checking..." : "Run check"}</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {MOCK_CONNECTORS.map((c, i) => (
          <div key={i} style={{ background: css.surface, backdropFilter: 'blur(16px)', border: `1px solid ${css.border}`, borderRadius: "12px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <PulsingDot color={healthColor(c.health)} />
            <div style={{ width: "120px" }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: css.text }}>{c.service}</div>
              <div style={{ fontSize: "0.6875rem", color: css.textMuted, fontFamily: "'DM Mono', monospace" }}>{c.id}</div>
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: "0.6875rem", padding: "0.2rem 0.5rem", borderRadius: "4px", background: severityBg(c.severity), color: severityText(c.severity), fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.health}</span>
            </div>
            <div style={{ flex: 2, fontSize: "0.8125rem", color: c.issue ? css.accentAmber : css.textMuted }}>{c.issue || "No issues detected"}</div>
            <div style={{ flex: 2, fontSize: "0.75rem", color: css.textMuted }}>{c.recommendation}</div>
            <div style={{ fontSize: "0.6875rem", color: css.textMuted }}>Every {c.syncFreq}</div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {["↺", "⏸", "🔍"].map((icon, j) => (
                <button key={j} title={["Retry", "Pause", "Logs"][j]} style={{
                  width: "28px", height: "28px", borderRadius: "6px", border: `1px solid ${css.border}`,
                  background: css.surface2, backdropFilter: 'blur(8px)', color: css.textMuted, cursor: "pointer", fontSize: "0.75rem",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{icon}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── SETTINGS ──────────────────────────────────────────────────────────────
  const SettingsPage = () => (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.375rem", fontWeight: 600, color: css.text, letterSpacing: "-0.02em" }}>Settings</h1>
      </div>
      {[
        {
          label: "Appearance", items: [
            { name: "Theme", desc: "Toggle between dark and light mode", control: <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} style={{ padding: "0.375rem 1rem", borderRadius: "6px", background: css.surface2, backdropFilter: 'blur(8px)', border: `1px solid ${css.border}`, color: css.text, cursor: "pointer", fontSize: "0.8125rem" }}>{theme === "dark" ? "☀ Light" : "🌙 Dark"}</button> },
          ]
        },
        {
          label: "Agent Configuration", items: [
            { name: "API Endpoint", desc: "Backend URL", control: <code style={{ fontSize: "0.75rem", color: css.accentBlue, fontFamily: "'DM Mono', monospace" }}>{API}</code> },
            { name: "Model", desc: "Gemini model in use", control: <code style={{ fontSize: "0.75rem", color: css.accent, fontFamily: "'DM Mono', monospace" }}>gemini-2.5-flash</code> },
            { name: "Demo Mode", desc: "Use mock Fivetran data", control: <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: "4px", background: "rgba(34,197,94,0.15)", color: css.accent }}>Active</span> },
          ]
        },
        {
          label: "Observability", items: [
            { name: "Phoenix Project", desc: "Arize tracing project", control: <code style={{ fontSize: "0.75rem", color: "#a78bfa", fontFamily: "'DM Mono', monospace" }}>conduit</code> },
            { name: "Open Phoenix", desc: "View full trace details", control: <a href="https://app.phoenix.arize.com" target="_blank" rel="noreferrer" style={{ fontSize: "0.8125rem", color: css.accentBlue, textDecoration: "none", fontWeight: 500 }}>Open →</a> },
          ]
        },
      ].map((section, si) => (
        <div key={si} style={{ background: css.surface, backdropFilter: 'blur(16px)', border: `1px solid ${css.border}`, borderRadius: "12px", overflow: "hidden", marginBottom: "0.75rem" }}>
          <div style={{ padding: "0.875rem 1.25rem", borderBottom: `1px solid ${css.border}`, fontSize: "0.75rem", fontWeight: 600, color: css.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{section.label}</div>
          {section.items.map((item, ii) => (
            <div key={ii} style={{ padding: "0.875rem 1.25rem", borderBottom: ii < section.items.length - 1 ? `1px solid ${css.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 500, color: css.text }}>{item.name}</div>
                <div style={{ fontSize: "0.75rem", color: css.textMuted, marginTop: "0.125rem" }}>{item.desc}</div>
              </div>
              {item.control}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  const pageComponents: Record<Exclude<Page, "home">, React.ReactNode> = {
    overview: <OverviewPage />,
    incidents: <IncidentsPage />,
    reasoning: <ReasoningPage />,
    evaluations: <EvaluationsPage />,
    traces: <TracesPage />,
    connectors: <ConnectorsPage />,
    settings: <SettingsPage />,
  };

  if (page === "home") {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'DM Sans', sans-serif; background: #000; }
          @keyframes pulse { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }
        `}</style>
        <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", background: "#0a0b0e", fontFamily: "'DM Sans', sans-serif" }}>
          <FrameSequence />

          {/* Overlay gradient so text is readable */}
          <div style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "100%", background: "linear-gradient(to right, rgba(10,11,14,0.95) 0%, rgba(10,11,14,0.4) 50%, transparent 100%)", zIndex: 1, pointerEvents: "none" }} />

          {/* Global Navigation Header transparent over video */}
          <header style={{
            position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "1.5rem 3rem", background: "linear-gradient(to bottom, rgba(10,11,14,0.8) 0%, transparent 100%)"
          }}>
            {/* Logo */}
            <div
              onClick={() => setPage("home")}
              style={{ display: "flex", alignItems: "center", gap: "0.875rem", cursor: "pointer" }}
            >
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: css.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(34,197,94,0.3)" }}>
                <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "#000", fontFamily: "'DM Mono', monospace" }}>C</span>
              </div>
              <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", fontFamily: "'DM Mono', monospace", letterSpacing: "-0.02em" }}>Conduit</span>
            </div>

            {/* Nav links */}
            <nav style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
              {["overview", "incidents", "reasoning", "connectors"].map((item) => (
                <button key={item} onClick={() => setPage(item as Page)} style={{
                  background: "transparent", border: "none", color: "rgba(255,255,255,0.7)",
                  fontSize: "0.9375rem", fontWeight: 500, cursor: "pointer", textTransform: "capitalize",
                  transition: "color 0.2s"
                }} onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}>
                  {item}
                </button>
              ))}
              <div style={{ width: "1px", height: "1.5rem", background: "rgba(255,255,255,0.15)" }} />
              <button onClick={() => setPage("settings")} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.7)", fontSize: "1.25rem", cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}>
                ⚙
              </button>
            </nav>
          </header>

          {/* Hero Content */}
          <div style={{
            position: "absolute", top: "50%", left: "4rem", transform: "translateY(-50%)", zIndex: 10,
            maxWidth: "680px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", padding: "0.5rem 1rem", borderRadius: "99px", width: "fit-content" }}>
              <PulsingDot color={css.accent} />
              <span style={{ fontSize: "0.75rem", color: css.accent, fontWeight: 600, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em" }}>PIPELINE ACTIVE</span>
            </div>
            <h1 style={{ fontSize: "4.5rem", fontWeight: 700, color: "#fff", lineHeight: 1.05, marginBottom: "1.5rem", letterSpacing: "-0.03em" }}>
              Data Pipelines.<br />
              <span style={{ color: "transparent", WebkitTextStroke: "1px rgba(255,255,255,0.8)" }}>Self-Healing.</span><br />
              Intelligent.
            </h1>
            <p style={{ fontSize: "1.125rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: "2.5rem", maxWidth: "480px", fontWeight: 300 }}>
              Conduit monitors, diagnoses, and autonomously resolves data incidents before they impact your business logic.
            </p>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button onClick={() => setPage("overview")} style={{
                padding: "1rem 2rem", borderRadius: "8px", background: css.accent, color: "#000",
                fontSize: "1rem", fontWeight: 600, border: "none", cursor: "pointer",
                boxShadow: "0 0 24px rgba(34, 197, 94, 0.4)", transition: "all 0.2s"
              }} onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(34, 197, 94, 0.6)"; }} onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 0 24px rgba(34, 197, 94, 0.4)"; }}>
                Enter Dashboard →
              </button>
              <button onClick={() => setPage("reasoning")} style={{
                padding: "1rem 2rem", borderRadius: "8px", background: "rgba(255,255,255,0.05)", color: "#fff",
                fontSize: "1rem", fontWeight: 500, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer",
                backdropFilter: "blur(10px)", transition: "all 0.2s"
              }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.border = "1px solid rgba(255,255,255,0.3)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.border = "1px solid rgba(255,255,255,0.15)"; }}>
                View Live Reasoning
              </button>
            </div>

            <div style={{ marginTop: "4rem", display: "flex", gap: "2.5rem" }}>
              <div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", fontFamily: "'DM Mono', monospace" }}>99.9%</div>
                <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.25rem" }}>Uptime</div>
              </div>
              <div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", fontFamily: "'DM Mono', monospace" }}>{`< 2.1s`}</div>
                <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.25rem" }}>Avg Reaction</div>
              </div>
              <div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", fontFamily: "'DM Mono', monospace" }}>24/7</div>
                <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.25rem" }}>Coverage</div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #040507; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ping { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(2.2); opacity: 0; } }
        .animate-ping { animation: ping 1.2s cubic-bezier(0,0,0.2,1) infinite; }
      `}</style>

      <div style={{ display: "flex", height: "100vh", background: "radial-gradient(circle at 15% 50%, rgba(34, 197, 94, 0.08), transparent 25%), radial-gradient(circle at 85% 30%, rgba(59, 130, 246, 0.08), transparent 25%), #040507", color: css.text, overflow: "hidden" }}>

        {/* Sidebar */}
        <aside style={{
          width: sidebarOpen ? "220px" : "56px", flexShrink: 0,
          background: css.surface, backdropFilter: 'blur(16px)', borderRight: `1px solid ${css.border}`,
          display: "flex", flexDirection: "column",
          transition: "width 0.2s ease", overflow: "hidden",
        }}>
          {/* Logo */}
          <div onClick={() => setPage("home")} style={{ padding: "1.25rem", borderBottom: `1px solid ${css.border}`, display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: css.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: "1rem", fontWeight: 700, color: "#000", fontFamily: "'DM Mono', monospace" }}>C</span>
            </div>
            {sidebarOpen && <span style={{ fontSize: "1.125rem", fontWeight: 700, color: css.text, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>Conduit</span>}
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, padding: "0.75rem 0" }}>
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => setPage(item.id)} style={{
                width: "100%", padding: sidebarOpen ? "0.625rem 1rem" : "0.625rem",
                display: "flex", alignItems: "center", gap: "0.75rem",
                background: page === item.id ? `${css.accent}18` : "transparent",
                borderTop: "none",
                borderRight: "none",
                borderBottom: "none",
                borderLeft: `2px solid ${page === item.id ? css.accent : "transparent"}`, cursor: "pointer", transition: "all 0.15s",
                color: page === item.id ? css.accent : css.textMuted,
              }}>
                <span style={{ fontSize: "1rem", flexShrink: 0, width: "20px", textAlign: "center" }}>{item.icon}</span>
                {sidebarOpen && <span style={{ fontSize: "0.8125rem", fontWeight: page === item.id ? 600 : 400, whiteSpace: "nowrap" }}>{item.label}</span>}
              </button>
            ))}
          </nav>

          {/* Collapse toggle */}
          <button onClick={() => setSidebarOpen(o => !o)} style={{
            padding: "0.875rem",
            borderTop: `1px solid ${css.border}`,
            borderRight: "none",
            borderBottom: "none",
            borderLeft: "none",
            background: "transparent",
            cursor: "pointer", color: css.textMuted, fontSize: "0.875rem",
            display: "flex", justifyContent: sidebarOpen ? "flex-end" : "center",
          }}>
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </aside>

        {/* Main */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Top bar */}
          <header style={{
            height: "52px", borderBottom: `1px solid ${css.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 1.5rem", background: css.surface, backdropFilter: 'blur(16px)', flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: css.text }}>{NAV_ITEMS.find(n => n.id === page)?.label}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <PulsingDot color={css.accent} />
                <span style={{ fontSize: "0.6875rem", color: css.textMuted, fontFamily: "'DM Mono', monospace" }}>SYSTEM NOMINAL</span>
              </div>
              <button onClick={runAgent} disabled={running} style={{
                padding: "0.375rem 1rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600,
                background: running ? css.surface2 : css.accent,
                color: running ? css.textMuted : "#000",
                boxShadow: running ? "none" : "0 0 12px rgba(34, 197, 94, 0.4)",
                border: "none", cursor: running ? "not-allowed" : "pointer",
                transition: "all 0.2s"
              }} onMouseEnter={e => { if (!running) e.currentTarget.style.boxShadow = "0 0 20px rgba(34, 197, 94, 0.6)"; }} onMouseLeave={e => { if (!running) e.currentTarget.style.boxShadow = "0 0 12px rgba(34, 197, 94, 0.4)"; }}>{running ? "Running..." : "▶ Run"}</button>
            </div>
          </header>

          {/* Page content */}
          <main style={{ flex: 1, overflow: "auto", padding: "1.75rem 2rem" }}>
            {pageComponents[page]}
          </main>
        </div>
      </div>
    </>
  );
}