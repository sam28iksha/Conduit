import sys

with open('app/page.tsx', 'r') as f:
    content = f.read()

# 1. Add "home" type
content = content.replace(
    'type Page = "overview" | "incidents"',
    'type Page = "home" | "overview" | "incidents"'
)

# 2. Add FrameSequence component just before OverviewPage
frame_sequence_code = r"""
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
"""

content = content.replace(
    '// ── OVERVIEW ──────────────────────────────────────────────────────────────',
    frame_sequence_code + '\n// ── OVERVIEW ──────────────────────────────────────────────────────────────'
)

# 3. Modify initial state
content = content.replace(
    'const [page, setPage] = useState<Page>("overview");',
    'const [page, setPage] = useState<Page>("home");'
)

# 4. Make sidebar logo clickable
sidebar_logo_old = """          {/* Logo */}
          <div style={{ padding: "1.25rem", borderBottom: `1px solid ${css.border}`, display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: css.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#000", fontFamily: "'DM Mono', monospace" }}>C</span>
            </div>
            {sidebarOpen && <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: css.text, fontFamily: "'DM Mono', monospace", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>Conduit</span>}
          </div>"""

sidebar_logo_new = """          {/* Logo */}
          <div onClick={() => setPage("home")} style={{ padding: "1.25rem", borderBottom: `1px solid ${css.border}`, display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: css.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#000", fontFamily: "'DM Mono', monospace" }}>C</span>
            </div>
            {sidebarOpen && <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: css.text, fontFamily: "'DM Mono', monospace", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>Conduit</span>}
          </div>"""

content = content.replace(sidebar_logo_old, sidebar_logo_new)

# 5. Modify page routing in return
return_code = """  const pageComponents: Record<Exclude<Page, "home">, React.ReactNode> = {
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
              Data Pipelines.<br/>
              <span style={{ color: "transparent", WebkitTextStroke: "1px rgba(255,255,255,0.8)" }}>Self-Healing.</span><br/>
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
  }"""

content = content.replace("""  const pageComponents: Record<Page, React.ReactNode> = {
    overview: <OverviewPage />,
    incidents: <IncidentsPage />,
    reasoning: <ReasoningPage />,
    evaluations: <EvaluationsPage />,
    traces: <TracesPage />,
    connectors: <ConnectorsPage />,
    settings: <SettingsPage />,
  };""", return_code)

with open('app/page.tsx', 'w') as f:
    f.write(content)
