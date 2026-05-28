import re

with open('app/page.tsx', 'r') as f:
    text = f.read()

# 1. Update T.green and T.bg using the exact RGB from screenshots
old_t = """  const T = {
    bg: "#040507",
    card: "rgba(255,255,255,0.03)",
    card2: "rgba(255,255,255,0.055)",
    border: "rgba(255,255,255,0.08)",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.45)",
    hint: "rgba(255,255,255,0.25)",
    green: "#22c55e",
    blue: "#3b82f6",
    amber: "#f59e0b",
    red: "#ef4444",
  };"""

new_t = """  const T = {
    bg: "#10121A", // Deep bluish-purple background
    card: "rgba(38, 41, 51, 0.4)", // Grayish purple shade
    card2: "rgba(69, 124, 184, 0.15)", // Interactive lighter shade
    border: "rgba(88, 108, 186, 0.2)", // Subtle purple border (#586CBA)
    text: "#ffffff",
    muted: "rgba(255,255,255,0.65)",
    hint: "rgba(255,255,255,0.4)",
    green: "#457CB8", // Replacing 'green' accent with exact cyan-blue shade from pipeline
    blue: "#586CBA", // Exact shade of purple
    amber: "#f59e0b",
    red: "#ef4444",
  };"""
text = text.replace(old_t, new_t)

# Make global styles match T.bg
text = text.replace("body { background: #040507; }", "body { background: #10121A; }")
text = text.replace("background: \"linear-gradient(to right, #040507 0%, transparent 35%, transparent 100%)\"", "background: \"linear-gradient(to right, #10121A 0%, transparent 35%, transparent 100%)\"")

# 2. Fix the initial routing to not snap to 'home' when reloading
old_state = '  const [page, setPage] = useState<Page>("home");'
new_state = """  const [page, setPage] = useState<Page>(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash.replace("#", "") as Page;
      const valid: Page[] = ["home", "overview", "incidents", "reasoning", "evaluations", "traces", "connectors"];
      if (valid.includes(h)) return h;
    }
    return "home";
  });"""
text = text.replace(old_state, new_state)

with open('app/page.tsx', 'w') as f:
    f.write(text)
