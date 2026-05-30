"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── TYPES ─────────────────────────────────────────────────────────────────
type Page =
  | "home"
  | "overview"
  | "incidents"
  | "reasoning"
  | "evaluations"
  | "traces"
  | "connectors"
  | "settings";

interface StreamEvent {
  type:
    | "start"
    | "text"
    | "tool_call"
    | "tool_result"
    | "eval"
    | "done"
    | "heartbeat";
  content?: string;
  tool?: string;
  scores?: Record<string, any>;
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
}

interface HealthData {
  average_score: number;
  total_runs: number;
  recent_scores: number[];
}

// ─── PALETTE ───────────────────────────────────────────────────────────────
// Light dashboard theme drawn entirely from the uploaded palette
const P = {
  // Backgrounds
  bg: "#D4D4DC",          // French gray — page background
  surface: "#E2E2E8",     // slightly lighter surface for cards
  surface2: "#CACAD4",    // slightly darker for inset areas

  // Borders
  border: "rgba(49,72,122,0.14)",
  borderStrong: "rgba(49,72,122,0.28)",

  // Text
  text: "#1a1c2e",        // near-black with a purple undertone
  textMuted: "#4a4d6a",   // mid-tone muted
  textHint: "#7a7d9a",    // light hint text

  // Accent — YInMn Blue (primary actions, active states)
  accent: "#31487A",
  accentLight: "rgba(49,72,122,0.10)",
  accentMid: "rgba(49,72,122,0.22)",

  // Secondary palette colors
  purple: "#5A3B7B",      // Eminence
  purpleLight: "rgba(90,59,123,0.12)",
  wisteria: "#A59AC9",    // Wisteria
  wisteriaLight: "rgba(165,154,201,0.18)",
  jordy: "#8FB3E2",       // Jordy Blue
  jordyLight: "rgba(143,179,226,0.18)",
  lilac: "#B8A9C9",       // Lilac
  lavender: "#D9E1F1",    // Lavender web

  // Score colors (mapped to palette)
  scoreHigh: "#31487A",
  scoreMid: "#5A3B7B",
  scoreLow: "#A59AC9",
  scoreFail: "#8c5a6e",

  // Health colors
  healthHealthy: "#31487A",
  healthDegraded: "#5A3B7B",
  healthError: "#8c5a6e",
  healthCritical: "#7a2a3e",
};

// ─── MOCK DATA ─────────────────────────────────────────────────────────────
const MOCK_CONNECTORS = [
  {
    id: "salesforce_prod",
    service: "Salesforce",
    health: "degraded",
    lastSync: "2m ago",
    issue: "Schema drift on Opportunity",
    severity: "high",
    syncFreq: "6h",
    recommendation: "Trigger resync after schema validation",
  },
  {
    id: "stripe_payments",
    service: "Stripe",
    health: "error",
    lastSync: "18m ago",
    issue: "Rate limit 429",
    severity: "medium",
    syncFreq: "3h",
    recommendation: "Exponential backoff, retry in 5min",
  },
  {
    id: "postgres_analytics",
    service: "PostgreSQL",
    health: "critical",
    lastSync: "2h ago",
    issue: "Auth credentials expired",
    severity: "critical",
    syncFreq: "24h",
    recommendation: "Human intervention required",
  },
  {
    id: "hubspot_crm",
    service: "HubSpot",
    health: "healthy",
    lastSync: "12m ago",
    issue: null,
    severity: "none",
    syncFreq: "1h",
    recommendation: "Operating normally",
  },
  {
    id: "bigquery_warehouse",
    service: "BigQuery",
    health: "healthy",
    lastSync: "5m ago",
    issue: null,
    severity: "none",
    syncFreq: "30m",
    recommendation: "Operating normally",
  },
];

const NAV_PAGES: { id: Exclude<Page, "home">; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "incidents", label: "Incidents" },
  { id: "reasoning", label: "Live Reasoning" },
  { id: "evaluations", label: "Evaluations" },
  { id: "traces", label: "Traces" },
  { id: "connectors", label: "Connectors" },
  { id: "settings", label: "Settings" },
];

// ─── UTILS ─────────────────────────────────────────────────────────────────
const scoreColor = (s: number) =>
  s >= 4.5
    ? P.scoreHigh
    : s >= 3.5
    ? P.scoreMid
    : s >= 2.5
    ? P.scoreLow
    : P.scoreFail;

const healthColor = (h: string) =>
  ({
    healthy: P.healthHealthy,
    degraded: P.healthDegraded,
    error: P.healthError,
    critical: P.healthCritical,
  }[h] || P.textHint);

// ─── SHARED COMPONENTS ─────────────────────────────────────────────────────
function StatusDot({ color }: { color: string }) {
  return (
    <span
      style={{ position: "relative", display: "inline-flex", width: 8, height: 8, flexShrink: 0 }}
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: color,
          opacity: 0.35,
          animation: "ping 1.4s infinite",
        }}
      />
      <span
        style={{
          position: "relative",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
        }}
      />
    </span>
  );
}

function Card({
  children,
  style = {},
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: P.surface,
        border: `1px solid ${P.border}`,
        borderRadius: 12,
        padding: "1.1rem 1.25rem",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2
      style={{
        fontSize: "1.25rem",
        fontWeight: 600,
        color: P.text,
        letterSpacing: "-0.02em",
        marginBottom: "0.25rem",
        fontFamily: "'DM Mono', monospace",
      }}
    >
      {children}
    </h2>
  );
}

function SectionSub({ children }: { children: string }) {
  return (
    <p style={{ fontSize: "0.8125rem", color: P.textMuted, marginBottom: "1.5rem" }}>
      {children}
    </p>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <span
        style={{
          fontSize: 11,
          color: P.textHint,
          width: 130,
          textTransform: "capitalize",
          fontFamily: "'DM Mono', monospace",
        }}
      >
        {label.replace(/_/g, " ")}
      </span>
      <div
        style={{
          flex: 1,
          height: 3,
          background: P.surface2,
          borderRadius: 2,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(value / 5) * 100}%`,
            background: scoreColor(value),
            borderRadius: 2,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: scoreColor(value),
          fontFamily: "'DM Mono', monospace",
          width: 20,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function RadarChart({ scores }: { scores: Record<string, number> }) {
  const dims = [
    "diagnosis_accuracy",
    "action_appropriateness",
    "reasoning_clarity",
    "escalation_judgment",
  ];
  const labels = ["Diagnosis", "Action", "Clarity", "Judgment"];
  const cx = 75,
    cy = 75,
    r = 55;
  const angles = dims.map((_, i) => (i / dims.length) * 2 * Math.PI - Math.PI / 2);
  const pts = dims
    .map((d, i) => {
      const v = (scores[d] || 0) / 5;
      return `${cx + Math.cos(angles[i]) * r * v},${cy + Math.sin(angles[i]) * r * v}`;
    })
    .join(" ");
  const gridPts = (f: number) =>
    dims
      .map((_, i) => `${cx + Math.cos(angles[i]) * r * f},${cy + Math.sin(angles[i]) * r * f}`)
      .join(" ");

  return (
    <svg width={150} height={150}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={gridPts(f)}
          fill="none"
          stroke={P.border}
          strokeWidth={1}
        />
      ))}
      {angles.map((a, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + Math.cos(a) * r}
          y2={cy + Math.sin(a) * r}
          stroke={P.border}
          strokeWidth={1}
        />
      ))}
      {pts && (
        <polygon
          points={pts}
          fill={P.accentLight}
          stroke={P.accent}
          strokeWidth={1.5}
        />
      )}
      {dims.map((d, i) => {
        const v = (scores[d] || 0) / 5;
        return (
          <circle
            key={i}
            cx={cx + Math.cos(angles[i]) * r * v}
            cy={cy + Math.sin(angles[i]) * r * v}
            r={3}
            fill={P.accent}
          />
        );
      })}
      {labels.map((l, i) => (
        <text
          key={i}
          x={cx + Math.cos(angles[i]) * (r + 16)}
          y={cy + Math.sin(angles[i]) * (r + 16)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fill={P.textHint}
          fontFamily="'DM Mono', monospace"
        >
          {l}
        </text>
      ))}
    </svg>
  );
}

// ─── TOP NAV ───────────────────────────────────────────────────────────────
function TopNav({
  active,
  running,
  onNav,
  onRun,
}: {
  active: Page;
  running: boolean;
  onNav: (p: Page) => void;
  onRun: () => void;
}) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(212,212,220,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${P.borderStrong}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 2rem",
        height: 52,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1.75rem" }}>
        <button
          onClick={() => onNav("home")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: P.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#fff",
                fontFamily: "'DM Mono', monospace",
              }}
            >
              C
            </span>
          </div>
          <span
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              color: P.text,
              fontFamily: "'DM Mono', monospace",
              letterSpacing: "-0.02em",
            }}
          >
            Conduit
          </span>
        </button>

        <nav style={{ display: "flex", gap: "0.125rem" }}>
          {NAV_PAGES.map((p) => (
            <button
              key={p.id}
              onClick={() => onNav(p.id)}
              style={{
                padding: "0.375rem 0.875rem",
                borderRadius: 6,
                fontSize: "0.8125rem",
                background: active === p.id ? P.accentLight : "transparent",
                color: active === p.id ? P.accent : P.textMuted,
                border: active === p.id ? `1px solid ${P.accentMid}` : "1px solid transparent",
                cursor: "pointer",
                fontWeight: active === p.id ? 600 : 400,
                transition: "all 0.15s",
              }}
            >
              {p.label}
            </button>
          ))}
        </nav>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StatusDot color={P.accent} />
          <span
            style={{
              fontSize: "0.6875rem",
              color: P.textHint,
              fontFamily: "'DM Mono', monospace",
              letterSpacing: "0.06em",
            }}
          >
            SYSTEM NOMINAL
          </span>
        </div>
        <button
          onClick={onRun}
          disabled={running}
          style={{
            padding: "0.375rem 1rem",
            borderRadius: 6,
            fontSize: "0.75rem",
            fontWeight: 600,
            background: running ? P.surface2 : P.accent,
            color: running ? P.textHint : "#fff",
            border: `1px solid ${running ? P.border : P.accent}`,
            cursor: running ? "not-allowed" : "pointer",
            transition: "all 0.15s",
            fontFamily: "'DM Mono', monospace",
            letterSpacing: "0.04em",
          }}
        >
          {running ? "Running..." : "Run"}
        </button>
      </div>
    </header>
  );
}

// ─── GLOBAL STYLES ─────────────────────────────────────────────────────────
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html { font-family: 'DM Sans', sans-serif; }
      body { background: ${P.bg}; color: ${P.text}; }
      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${P.accentMid}; border-radius: 2px; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
      @keyframes pulse { 0%,100% { opacity: 0.25; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }
      @keyframes ping { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2); opacity: 0; } }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `}</style>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────
export default function ConduitApp() {
  const [page, setPage] = useState<Page>("home");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [lastRunMs, setLastRunMs] = useState<number | null>(null);
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
  const [incidentFilter, setIncidentFilter] = useState<"all" | "resolved" | "escalated">("all");
  const esRef = useRef<EventSource | null>(null);
  const reasoningRef = useRef<HTMLDivElement>(null);

  const nav = (p: Page) => {
    setPage(p);
    if (p === "reasoning") setStreamEvents([]);
  };

  const fetchData = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        fetch(`${API}/incidents`).then((r) => r.json()),
        fetch(`${API}/health/score`).then((r) => r.json()),
      ]);
      setIncidents(a.incidents || []);
      setHealth(b);
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [streamEvents]);

  const runAgent = async () => {
    if (running) return;
    setRunning(true);
    setStreamEvents([]);
    const t0 = Date.now();
    try {
      const res = await fetch(`${API}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Check all pipeline connectors and report their current status.",
        }),
      });
      const { session_id } = await res.json();
      const es = new EventSource(`${API}/stream/${session_id}`);
      esRef.current = es;
      es.onmessage = (e) => {
        const evt: StreamEvent = JSON.parse(e.data);
        if (evt.type === "done") {
          es.close();
          setRunning(false);
          setLastRunMs(Date.now() - t0);
          fetchData();
          return;
        }
        if (evt.type !== "heartbeat") setStreamEvents((p) => [...p, evt]);
      };
      es.onerror = () => {
        es.close();
        setRunning(false);
      };
    } catch {
      setRunning(false);
    }
  };

  // Derived values
  const avgScore = health?.average_score || 0;
  const totalRuns = health?.total_runs || 0;
  const recentScores = health?.recent_scores || [];
  const autoFixed = incidents.filter((i) => i.overall_score >= 4).length;
  const escalatedCount = incidents.filter((i) => i.overall_score < 3).length;
  const healthyCount = MOCK_CONNECTORS.filter((c) => c.health === "healthy").length;
  const failedCount = MOCK_CONNECTORS.filter((c) => c.health !== "healthy").length;

  // ── HOME PAGE ─────────────────────────────────────────────────────────────
  if (page === "home") {
    // Frame sequence component — identical logic & paths from code 1
    const FrameSequence = () => {
      const canvasRef = useRef<HTMLCanvasElement>(null);
      const [images, setImages] = useState<HTMLImageElement[]>([]);
      const [loaded, setLoaded] = useState(false);
      const frameCount = 192;

      useEffect(() => {
        let isMounted = true;
        const loadedImages: HTMLImageElement[] = [];
        let loadedCount = 0;

        for (let i = 1; i <= frameCount; i++) {
          const img = new Image();
          img.src = `/frame/ezgif-frame-${String(i).padStart(3, "0")}.jpg`;
          img.onload = () => {
            loadedCount++;
            if (loadedCount === frameCount && isMounted) setLoaded(true);
          };
          img.onerror = () => {
            loadedCount++;
            if (loadedCount === frameCount && isMounted) setLoaded(true);
          };
          loadedImages.push(img);
        }
        if (isMounted) setImages(loadedImages);
        return () => {
          isMounted = false;
        };
      }, []);

      useEffect(() => {
        if (!loaded || !canvasRef.current || images.length === 0) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const cw = images[0].width || 1280;
        const ch = images[0].height || 720;
        canvas.width = cw;
        canvas.height = ch;

        let frame = 0;
        let animationId: number;
        let lastTime = performance.now();
        const interval = 1000 / 30;

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
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 0,
              opacity: loaded ? 1 : 0,
              transition: "opacity 1s ease-in-out",
            }}
          />
          {!loaded && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#0a0b0e",
                zIndex: 1,
              }}
            >
              <div
                style={{
                  color: "#fff",
                  fontFamily: "'DM Mono', monospace",
                  opacity: 0.4,
                  fontSize: "0.8rem",
                  letterSpacing: "0.08em",
                }}
              >
                Loading Pipeline Stream...
              </div>
            </div>
          )}
        </>
      );
    };

    return (
      <>
        <GlobalStyles />
        <style>{`
          @keyframes pulse { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }
        `}</style>
        <div
          style={{
            position: "relative",
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            background: "#0a0b0e",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <FrameSequence />

          {/* Left fade overlay so hero text is readable */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "55%",
              height: "100%",
              background:
                "linear-gradient(to right, rgba(10,11,14,0.96) 0%, rgba(10,11,14,0.5) 60%, transparent 100%)",
              zIndex: 1,
              pointerEvents: "none",
            }}
          />

          {/* Nav header */}
          <header
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "1.5rem 3rem",
              background:
                "linear-gradient(to bottom, rgba(10,11,14,0.75) 0%, transparent 100%)",
            }}
          >
            <button
              onClick={() => nav("home")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.875rem",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: P.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 20px rgba(49,72,122,0.4)",
                }}
              >
                <span
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: 700,
                    color: "#fff",
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  C
                </span>
              </div>
              <span
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "#fff",
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "-0.02em",
                }}
              >
                Conduit
              </span>
            </button>

            <nav style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
              {(["overview", "incidents", "reasoning", "connectors"] as Page[]).map((item) => (
                <button
                  key={item}
                  onClick={() => nav(item)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "rgba(255,255,255,0.65)",
                    fontSize: "0.9375rem",
                    fontWeight: 400,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    letterSpacing: "0.01em",
                    transition: "color 0.2s",
                    padding: 0,
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = "#fff")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.color =
                      "rgba(255,255,255,0.65)")
                  }
                >
                  {item}
                </button>
              ))}
              <div
                style={{
                  width: "1px",
                  height: "1.25rem",
                  background: "rgba(255,255,255,0.15)",
                }}
              />
              <button
                onClick={() => nav("settings")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.55)",
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.06em",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "#fff")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color =
                    "rgba(255,255,255,0.55)")
                }
              >
                Settings
              </button>
            </nav>
          </header>

          {/* Hero content */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "4rem",
              transform: "translateY(-50%)",
              zIndex: 10,
              maxWidth: 620,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "1.5rem",
                background: "rgba(49,72,122,0.15)",
                border: "1px solid rgba(49,72,122,0.35)",
                padding: "0.4rem 1rem",
                borderRadius: 99,
              }}
            >
              <StatusDot color={P.jordy} />
              <span
                style={{
                  fontSize: "0.6875rem",
                  color: P.jordy,
                  fontWeight: 600,
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.1em",
                }}
              >
                PIPELINE ACTIVE
              </span>
            </div>

            <h1
              style={{
                fontSize: "4.25rem",
                fontWeight: 700,
                color: "#fff",
                lineHeight: 1.06,
                marginBottom: "1.5rem",
                letterSpacing: "-0.035em",
                fontFamily: "'DM Mono', monospace",
              }}
            >
              Data Pipelines.
              <br />
              <span
                style={{
                  color: "transparent",
                  WebkitTextStroke: "1px rgba(255,255,255,0.55)",
                }}
              >
                Self-Healing.
              </span>
              <br />
              Intelligent.
            </h1>

            <p
              style={{
                fontSize: "1.0625rem",
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.65,
                marginBottom: "2.25rem",
                maxWidth: 460,
                fontWeight: 300,
              }}
            >
              Conduit monitors, diagnoses, and autonomously resolves data incidents
              before they impact your business logic.
            </p>

            <div style={{ display: "flex", gap: "0.875rem", marginBottom: "3.5rem" }}>
              <button
                onClick={() => nav("overview")}
                style={{
                  padding: "0.875rem 2rem",
                  borderRadius: 8,
                  background: P.accent,
                  color: "#fff",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 0 24px rgba(49,72,122,0.5)",
                  transition: "all 0.2s",
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.02em",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(-2px)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 8px 28px rgba(49,72,122,0.65)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 0 24px rgba(49,72,122,0.5)";
                }}
              >
                Enter Dashboard
              </button>
              <button
                onClick={() => nav("reasoning")}
                style={{
                  padding: "0.875rem 2rem",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  fontSize: "0.9375rem",
                  fontWeight: 400,
                  border: "1px solid rgba(255,255,255,0.16)",
                  cursor: "pointer",
                  backdropFilter: "blur(10px)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(255,255,255,0.11)";
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(255,255,255,0.3)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(255,255,255,0.06)";
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(255,255,255,0.16)";
                }}
              >
                View Live Reasoning
              </button>
            </div>

            <div style={{ display: "flex", gap: "2.75rem" }}>
              {[
                { val: "99.9%", label: "UPTIME" },
                { val: "< 2.1s", label: "AVG REACTION" },
                { val: "24/7", label: "COVERAGE" },
              ].map((s, i) => (
                <div key={i}>
                  <div
                    style={{
                      fontSize: "1.625rem",
                      fontWeight: 700,
                      color: "#fff",
                      fontFamily: "'DM Mono', monospace",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {s.val}
                  </div>
                  <div
                    style={{
                      fontSize: "0.625rem",
                      color: "rgba(255,255,255,0.38)",
                      letterSpacing: "0.1em",
                      fontFamily: "'DM Mono', monospace",
                      marginTop: 3,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── DASHBOARD PAGES ───────────────────────────────────────────────────────

  // ── OVERVIEW ──────────────────────────────────────────────────────────────
  const Overview = () => (
    <div>
      <SectionTitle>System Overview</SectionTitle>
      <SectionSub>Pipeline intelligence across all connected data sources</SectionSub>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 10,
          marginBottom: 12,
        }}
      >
        {[
          { label: "Healthy", value: `${healthyCount}/${MOCK_CONNECTORS.length}`, color: P.accent },
          { label: "Failing", value: failedCount, color: P.scoreFail },
          { label: "Auto-resolved", value: autoFixed, color: P.purple },
          { label: "Escalated", value: escalatedCount, color: P.wisteria },
          {
            label: "Avg AI score",
            value: avgScore ? `${avgScore.toFixed(2)}/5` : "--",
            color: scoreColor(avgScore),
          },
          { label: "Total runs", value: totalRuns, color: P.jordy },
        ].map((m, i) => (
          <div
            key={i}
            style={{
              background: P.surface,
              border: `1px solid ${P.border}`,
              borderRadius: 10,
              padding: "0.875rem 1rem",
            }}
          >
            <div
              style={{
                fontSize: "0.625rem",
                color: P.textHint,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 6,
                fontFamily: "'DM Mono', monospace",
              }}
            >
              {m.label}
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: m.color,
                fontFamily: "'DM Mono', monospace",
                lineHeight: 1,
              }}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 10, marginBottom: 10 }}
      >
        <Card>
          <div
            style={{
              fontSize: "0.65rem",
              color: P.textHint,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: 12,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            AI score trend
          </div>
          {recentScores.length > 1 ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 52 }}>
              {recentScores.map((s, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: `${(s / 5) * 40}px`,
                      borderRadius: "2px 2px 0 0",
                      background: scoreColor(s),
                      opacity: i === recentScores.length - 1 ? 1 : 0.45,
                    }}
                  />
                  <span style={{ fontSize: "0.55rem", color: P.textHint }}>{s}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: P.textHint, fontSize: "0.8rem" }}>
              Run the agent to see trends
            </div>
          )}
        </Card>

        <Card>
          <div
            style={{
              fontSize: "0.65rem",
              color: P.textHint,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: 10,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            Recent incidents
          </div>
          {incidents.length === 0 ? (
            <div style={{ color: P.textHint, fontSize: "0.8125rem" }}>No incidents yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {incidents.slice(0, 4).map((inc, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "0.4rem 0.75rem",
                    background: P.surface2,
                    borderRadius: 7,
                  }}
                >
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: scoreColor(inc.overall_score),
                      flexShrink: 0,
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      fontSize: "0.75rem",
                      color: P.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {inc.key_finding?.slice(0, 60) || "Analyzed"}...
                  </div>
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      color: scoreColor(inc.overall_score),
                      fontFamily: "'DM Mono', monospace",
                      flexShrink: 0,
                    }}
                  >
                    {inc.overall_score}/5
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div
          style={{
            fontSize: "0.65rem",
            color: P.textHint,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            marginBottom: 10,
            fontFamily: "'DM Mono', monospace",
          }}
        >
          Connector health
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {MOCK_CONNECTORS.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <StatusDot color={healthColor(c.health)} />
              <span
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: P.text,
                  width: 130,
                }}
              >
                {c.service}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 3,
                  background: P.surface2,
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width:
                      c.health === "healthy"
                        ? "100%"
                        : c.health === "degraded"
                        ? "60%"
                        : c.health === "error"
                        ? "28%"
                        : "8%",
                    background: healthColor(c.health),
                    borderRadius: 2,
                    transition: "width 1s ease",
                  }}
                />
              </div>
              <span
                style={{ fontSize: "0.6875rem", color: P.textHint, width: 180, textAlign: "right" }}
              >
                {c.issue || "Healthy"}
              </span>
              <span
                style={{ fontSize: "0.6875rem", color: P.textHint, width: 60, textAlign: "right" }}
              >
                {c.lastSync}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  // ── INCIDENTS ─────────────────────────────────────────────────────────────
  const Incidents = () => {
    const filtered = incidents.filter((inc) => {
      if (incidentFilter === "resolved") return inc.overall_score >= 4;
      if (incidentFilter === "escalated") return inc.overall_score < 3;
      return true;
    });
    const statusLabel = (s: number) => {
      if (s >= 5) return { t: "AUTO-RESOLVED", c: P.accent };
      if (s >= 4) return { t: "RESOLVED", c: P.purple };
      if (s >= 3) return { t: "INVESTIGATING", c: P.wisteria };
      return { t: "ESCALATED", c: P.scoreFail };
    };
    return (
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <SectionTitle>Incidents</SectionTitle>
            <p style={{ fontSize: "0.8125rem", color: P.textMuted }}>
              {incidents.length} total recorded
            </p>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {(["all", "resolved", "escalated"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setIncidentFilter(f)}
                style={{
                  padding: "0.35rem 0.875rem",
                  borderRadius: 6,
                  fontSize: "0.75rem",
                  background: incidentFilter === f ? P.accent : P.surface2,
                  color: incidentFilter === f ? "#fff" : P.textMuted,
                  border: `1px solid ${incidentFilter === f ? P.accent : P.border}`,
                  cursor: "pointer",
                  fontWeight: incidentFilter === f ? 600 : 400,
                  transition: "all 0.15s",
                }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card style={{ textAlign: "center", padding: "3rem", color: P.textHint }}>
            No incidents match this filter
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map((inc, i) => {
              const st = statusLabel(inc.overall_score);
              const open = expandedIncident === inc.incident_id;
              return (
                <div
                  key={i}
                  style={{
                    background: P.surface,
                    border: `1px solid ${P.border}`,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <div
                    onClick={() =>
                      setExpandedIncident(open ? null : inc.incident_id)
                    }
                    style={{
                      padding: "0.875rem 1.25rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    <StatusDot color={st.c} />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 3,
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.6rem",
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: `${st.c}18`,
                            color: st.c,
                            letterSpacing: "0.06em",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {st.t}
                        </span>
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            color: P.textHint,
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          #{inc.incident_id.slice(0, 8)}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.8125rem", color: P.text, lineHeight: 1.4 }}>
                        {inc.key_finding?.slice(0, 110) || "Incident analyzed"}...
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: "1.375rem",
                          fontWeight: 700,
                          color: scoreColor(inc.overall_score),
                          fontFamily: "'DM Mono', monospace",
                          lineHeight: 1,
                        }}
                      >
                        {inc.overall_score}
                        <span style={{ fontSize: "0.75rem", opacity: 0.4 }}>/5</span>
                      </div>
                    </div>
                    <span style={{ color: P.textHint, fontSize: "0.75rem" }}>
                      {open ? "^" : "v"}
                    </span>
                  </div>
                  {open && (
                    <div
                      style={{
                        borderTop: `1px solid ${P.border}`,
                        padding: "1rem 1.25rem",
                        background: P.surface2,
                      }}
                    >
                      <div
                        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "0.65rem",
                              color: P.textHint,
                              textTransform: "uppercase",
                              letterSpacing: "0.07em",
                              marginBottom: 10,
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            Evaluator breakdown
                          </div>
                          {(
                            [
                              "diagnosis_accuracy",
                              "action_appropriateness",
                              "reasoning_clarity",
                              "escalation_judgment",
                            ] as const
                          ).map((d) => (
                            <ScoreBar key={d} label={d} value={(inc as any)[d] || 0} />
                          ))}
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "0.65rem",
                              color: P.textHint,
                              textTransform: "uppercase",
                              letterSpacing: "0.07em",
                              marginBottom: 10,
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            Suggestion
                          </div>
                          <p style={{ fontSize: "0.8125rem", color: P.text, lineHeight: 1.65 }}>
                            {inc.improvement_suggestion || "No suggestions"}
                          </p>
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
  const Reasoning = () => {
    const eventColor = (t: string) =>
      ({
        start: P.jordy,
        tool_call: P.purple,
        tool_result: P.wisteria,
        text: P.text,
        eval: P.accent,
      }[t] || P.textHint);

    return (
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <SectionTitle>Live Reasoning</SectionTitle>
            <p style={{ fontSize: "0.8125rem", color: P.textMuted }}>
              Real-time agent decision stream
            </p>
          </div>
          <button
            onClick={runAgent}
            disabled={running}
            style={{
              padding: "0.5rem 1.375rem",
              borderRadius: 8,
              fontSize: "0.8125rem",
              fontWeight: 600,
              background: running ? P.surface2 : P.accent,
              color: running ? P.textHint : "#fff",
              border: `1px solid ${running ? P.border : P.accent}`,
              cursor: running ? "not-allowed" : "pointer",
              fontFamily: "'DM Mono', monospace",
              letterSpacing: "0.04em",
            }}
          >
            {running ? "Agent running..." : "Run pipeline check"}
          </button>
        </div>

        <div
          ref={reasoningRef}
          style={{
            background: P.surface,
            border: `1px solid ${P.border}`,
            borderRadius: 12,
            padding: "1.25rem",
            minHeight: 380,
            maxHeight: "62vh",
            overflowY: "auto",
            fontFamily: "'DM Mono', monospace",
            fontSize: "0.8125rem",
          }}
        >
          {streamEvents.length === 0 && !running ? (
            <div
              style={{
                color: P.textHint,
                textAlign: "center",
                paddingTop: "3rem",
              }}
            >
              <div
                style={{
                  fontSize: "1.5rem",
                  marginBottom: "1rem",
                  opacity: 0.2,
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                --
              </div>
              Click "Run pipeline check" to start
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {streamEvents.map((evt, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    padding: "3px 0",
                    animation: "fadeIn 0.25s ease",
                  }}
                >
                  <span
                    style={{
                      color: eventColor(evt.type),
                      flexShrink: 0,
                      width: 14,
                      fontSize: "0.75rem",
                      paddingTop: 1,
                    }}
                  >
                    {evt.type === "tool_call"
                      ? ">"
                      : evt.type === "tool_result"
                      ? "<"
                      : evt.type === "eval"
                      ? "#"
                      : "-"}
                  </span>
                  <div style={{ flex: 1 }}>
                    {evt.type === "tool_call" && (
                      <span style={{ color: P.purple }}>
                        Calling <strong>{evt.tool}</strong>()
                      </span>
                    )}
                    {evt.type === "tool_result" && (
                      <span style={{ color: P.wisteria }}>{evt.tool} returned data</span>
                    )}
                    {evt.type === "text" && (
                      <span style={{ color: P.text, lineHeight: 1.6 }}>{evt.content}</span>
                    )}
                    {evt.type === "start" && (
                      <span style={{ color: P.jordy }}>Session started</span>
                    )}
                    {evt.type === "eval" && evt.scores && (
                      <div
                        style={{
                          background: P.surface2,
                          borderRadius: 8,
                          padding: "0.6rem 0.875rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.65rem",
                              color: P.textHint,
                              textTransform: "uppercase",
                              letterSpacing: "0.07em",
                            }}
                          >
                            Eval complete
                          </span>
                          <span
                            style={{
                              fontSize: "1rem",
                              fontWeight: 700,
                              color: scoreColor(evt.scores.overall_score as number),
                            }}
                          >
                            {evt.scores.overall_score as number}/5
                          </span>
                        </div>
                        <p style={{ fontSize: "0.8rem", color: P.text, lineHeight: 1.5 }}>
                          {evt.scores.key_finding as string}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {running && (
                <div style={{ display: "flex", gap: 4, padding: "0.5rem 0 0 26px" }}>
                  {[0, 1, 2].map((j) => (
                    <div
                      key={j}
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: P.accent,
                        animation: `pulse 1.2s ${j * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {lastRunMs && (
          <div
            style={{
              marginTop: 8,
              fontSize: "0.75rem",
              color: P.textHint,
              textAlign: "right",
              fontFamily: "'DM Mono', monospace",
            }}
          >
            Last run: {(lastRunMs / 1000).toFixed(1)}s
          </div>
        )}
      </div>
    );
  };

  // ── EVALUATIONS ───────────────────────────────────────────────────────────
  const Evaluations = () => {
    const latest = incidents[0];
    const dist = [1, 2, 3, 4, 5].map((s) => ({
      score: s,
      count: incidents.filter((i) => Math.round(i.overall_score) === s).length,
    }));
    const maxC = Math.max(...dist.map((d) => d.count), 1);

    return (
      <div>
        <SectionTitle>Evaluations</SectionTitle>
        <SectionSub>LLM-as-a-Judge quality metrics</SectionSub>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}
        >
          {[
            {
              label: "Avg score",
              value: avgScore ? avgScore.toFixed(2) : "--",
              color: scoreColor(avgScore),
            },
            { label: "Total evaluated", value: incidents.length, color: P.jordy },
            {
              label: "Best score",
              value:
                incidents.length
                  ? Math.max(...incidents.map((i) => i.overall_score)) + "/5"
                  : "--",
              color: P.accent,
            },
          ].map((m, i) => (
            <Card key={i} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "0.65rem",
                  color: P.textHint,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  marginBottom: 6,
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                {m.label}
              </div>
              <div
                style={{
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: m.color,
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                {m.value}
              </div>
            </Card>
          ))}
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, marginBottom: 10 }}
        >
          {latest ? (
            <Card
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  color: P.textHint,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  marginBottom: 8,
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                Latest
              </div>
              <RadarChart scores={latest as any} />
            </Card>
          ) : (
            <div />
          )}

          <Card>
            <div
              style={{
                fontSize: "0.65rem",
                color: P.textHint,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 12,
                fontFamily: "'DM Mono', monospace",
              }}
            >
              Score distribution
            </div>
            {dist.map((d) => (
              <div
                key={d.score}
                style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontFamily: "'DM Mono', monospace",
                    color: scoreColor(d.score),
                    width: 14,
                  }}
                >
                  {d.score}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    background: P.surface2,
                    borderRadius: 3,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(d.count / maxC) * 100}%`,
                      background: scoreColor(d.score),
                      borderRadius: 3,
                      transition: "width 0.7s ease",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: P.textHint,
                    width: 18,
                    textAlign: "right",
                  }}
                >
                  {d.count}
                </span>
              </div>
            ))}
          </Card>
        </div>

        <Card>
          <div
            style={{
              fontSize: "0.65rem",
              color: P.textHint,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: 10,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            Evaluation log
          </div>
          {incidents.length === 0 ? (
            <div style={{ color: P.textHint, fontSize: "0.8125rem" }}>No evaluations yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {incidents.slice(0, 6).map((inc, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "0.5rem 0.875rem",
                    background: P.surface2,
                    borderRadius: 7,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: `${scoreColor(inc.overall_score)}18`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        color: scoreColor(inc.overall_score),
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      {inc.overall_score}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "0.8rem", color: P.text, marginBottom: 2 }}>
                      {inc.key_finding?.slice(0, 80) || "Analyzed"}...
                    </p>
                    <p style={{ fontSize: "0.6875rem", color: P.textHint }}>
                      {inc.improvement_suggestion?.slice(0, 65) || ""}...
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  };

  // ── TRACES ────────────────────────────────────────────────────────────────
  const Traces = () => (
    <div>
      <SectionTitle>Phoenix Traces</SectionTitle>
      <SectionSub>
        Full observability via Arize Phoenix — every LLM call, tool invocation, and eval score
      </SectionSub>

      <Card style={{ marginBottom: 10, overflow: "hidden", padding: 0 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 80px",
            padding: "0.75rem 1.25rem",
            borderBottom: `1px solid ${P.border}`,
          }}
        >
          {["Trace ID", "Tools called", "Score"].map((h) => (
            <div
              key={h}
              style={{
                fontSize: "0.65rem",
                fontWeight: 600,
                color: P.textHint,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                fontFamily: "'DM Mono', monospace",
              }}
            >
              {h}
            </div>
          ))}
        </div>
        {incidents.length === 0 ? (
          <div
            style={{
              padding: "2.5rem",
              textAlign: "center",
              color: P.textHint,
              fontSize: "0.8125rem",
            }}
          >
            No traces yet. Run the agent.
          </div>
        ) : (
          incidents.map((inc, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 80px",
                padding: "0.75rem 1.25rem",
                borderBottom:
                  i < incidents.length - 1 ? `1px solid ${P.border}` : "none",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontFamily: "'DM Mono', monospace",
                    color: P.accent,
                  }}
                >
                  {inc.incident_id}
                </div>
                <div style={{ fontSize: "0.6875rem", color: P.textHint }}>
                  Conduit agent run
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {["list_connectors", "get_details", "get_logs"].map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: "0.5875rem",
                      padding: "1px 5px",
                      borderRadius: 3,
                      background: P.accentLight,
                      color: P.accent,
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    color: scoreColor(inc.overall_score),
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {inc.overall_score}/5
                </span>
              </div>
            </div>
          ))
        )}
      </Card>

      <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.8125rem", color: P.textMuted }}>
          Full trace details with span-level latency available in Phoenix Cloud
        </span>
        <a
          href="https://app.phoenix.arize.com"
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: "0.8125rem",
            color: P.accent,
            textDecoration: "none",
            fontWeight: 600,
            fontFamily: "'DM Mono', monospace",
          }}
        >
          Open Phoenix
        </a>
      </Card>
    </div>
  );

  // ── CONNECTORS ────────────────────────────────────────────────────────────
  const Connectors = () => (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <SectionTitle>Connectors</SectionTitle>
          <p style={{ fontSize: "0.8125rem", color: P.textMuted }}>
            Fivetran pipeline status — {healthyCount} healthy, {failedCount} failing
          </p>
        </div>
        <button
          onClick={runAgent}
          disabled={running}
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: 8,
            fontSize: "0.8125rem",
            fontWeight: 600,
            background: running ? P.surface2 : P.accent,
            color: running ? P.textHint : "#fff",
            border: `1px solid ${running ? P.border : P.accent}`,
            cursor: running ? "not-allowed" : "pointer",
            fontFamily: "'DM Mono', monospace",
            letterSpacing: "0.04em",
          }}
        >
          {running ? "Checking..." : "Run check"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {MOCK_CONNECTORS.map((c, i) => (
          <div
            key={i}
            style={{
              background: P.surface,
              border: `1px solid ${P.border}`,
              borderRadius: 12,
              padding: "0.875rem 1.25rem",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <StatusDot color={healthColor(c.health)} />
            <div style={{ width: 130 }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 500, color: P.text }}>
                {c.service}
              </div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  color: P.textHint,
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                {c.id}
              </div>
            </div>
            <span
              style={{
                fontSize: "0.6rem",
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 4,
                background: `${healthColor(c.health)}18`,
                color: healthColor(c.health),
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontFamily: "'DM Mono', monospace",
                flexShrink: 0,
              }}
            >
              {c.health}
            </span>
            <div
              style={{
                flex: 1,
                fontSize: "0.8125rem",
                color: c.issue ? P.purple : P.textHint,
              }}
            >
              {c.issue || "No issues"}
            </div>
            <div style={{ fontSize: "0.75rem", color: P.textHint }}>
              Every {c.syncFreq}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: P.textHint,
                width: 60,
                textAlign: "right",
              }}
            >
              {c.lastSync}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {[
                ["Retry", "R"],
                ["Pause", "P"],
                ["Logs", "L"],
              ].map(([title, label], j) => (
                <button
                  key={j}
                  title={title}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 5,
                    border: `1px solid ${P.border}`,
                    background: P.surface2,
                    color: P.textMuted,
                    cursor: "pointer",
                    fontSize: "0.6rem",
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    letterSpacing: "0.04em",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── SETTINGS ──────────────────────────────────────────────────────────────
  const Settings = () => (
    <div>
      <SectionTitle>Settings</SectionTitle>
      <SectionSub>Configuration and integrations</SectionSub>

      {[
        {
          label: "Agent Configuration",
          items: [
            {
              name: "API Endpoint",
              desc: "Backend URL for the Conduit agent",
              control: (
                <code
                  style={{
                    fontSize: "0.75rem",
                    color: P.accent,
                    fontFamily: "'DM Mono', monospace",
                    background: P.accentLight,
                    padding: "2px 8px",
                    borderRadius: 4,
                  }}
                >
                  {API}
                </code>
              ),
            },
            {
              name: "Model",
              desc: "Language model powering the agent",
              control: (
                <code
                  style={{
                    fontSize: "0.75rem",
                    color: P.purple,
                    fontFamily: "'DM Mono', monospace",
                    background: P.purpleLight,
                    padding: "2px 8px",
                    borderRadius: 4,
                  }}
                >
                  gemini-2.5-flash
                </code>
              ),
            },
            {
              name: "Demo Mode",
              desc: "Use mock Fivetran connector data",
              control: (
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: P.accentLight,
                    color: P.accent,
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 600,
                  }}
                >
                  Active
                </span>
              ),
            },
          ],
        },
        {
          label: "Observability",
          items: [
            {
              name: "Phoenix Project",
              desc: "Arize tracing project identifier",
              control: (
                <code
                  style={{
                    fontSize: "0.75rem",
                    color: P.jordy,
                    fontFamily: "'DM Mono', monospace",
                    background: P.jordyLight,
                    padding: "2px 8px",
                    borderRadius: 4,
                  }}
                >
                  conduit
                </code>
              ),
            },
            {
              name: "Phoenix Cloud",
              desc: "View full span-level trace details",
              control: (
                <a
                  href="https://app.phoenix.arize.com"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: "0.8125rem",
                    color: P.accent,
                    textDecoration: "none",
                    fontWeight: 600,
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  Open Phoenix
                </a>
              ),
            },
          ],
        },
        {
          label: "Pipeline",
          items: [
            {
              name: "Check Interval",
              desc: "How often the agent automatically runs",
              control: (
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: P.textMuted,
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  Manual
                </span>
              ),
            },
            {
              name: "Auto-escalation",
              desc: "Escalate incidents with score below 2",
              control: (
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: P.purpleLight,
                    color: P.purple,
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 600,
                  }}
                >
                  Enabled
                </span>
              ),
            },
          ],
        },
      ].map((section, si) => (
        <div
          key={si}
          style={{
            background: P.surface,
            border: `1px solid ${P.border}`,
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: "0.75rem",
          }}
        >
          <div
            style={{
              padding: "0.75rem 1.25rem",
              borderBottom: `1px solid ${P.border}`,
              fontSize: "0.65rem",
              fontWeight: 700,
              color: P.textHint,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontFamily: "'DM Mono', monospace",
              background: P.surface2,
            }}
          >
            {section.label}
          </div>
          {section.items.map((item, ii) => (
            <div
              key={ii}
              style={{
                padding: "0.875rem 1.25rem",
                borderBottom:
                  ii < section.items.length - 1 ? `1px solid ${P.border}` : "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 500, color: P.text }}>
                  {item.name}
                </div>
                <div
                  style={{ fontSize: "0.75rem", color: P.textHint, marginTop: "0.125rem" }}
                >
                  {item.desc}
                </div>
              </div>
              {item.control}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  // ── DASHBOARD SHELL ───────────────────────────────────────────────────────
  const pageComponents: Record<Exclude<Page, "home">, React.ReactNode> = {
    overview: <Overview />,
    incidents: <Incidents />,
    reasoning: <Reasoning />,
    evaluations: <Evaluations />,
    traces: <Traces />,
    connectors: <Connectors />,
    settings: <Settings />,
  };

  return (
    <>
      <GlobalStyles />
      <div style={{ minHeight: "100vh", background: P.bg, color: P.text }}>
        <TopNav
          active={page}
          running={running}
          onNav={nav}
          onRun={runAgent}
        />
        <main
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "2rem 2rem 4rem",
          }}
        >
          {pageComponents[page as Exclude<Page, "home">]}
        </main>
      </div>
    </>
  );
}