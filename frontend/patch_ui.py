import re

with open('app/page.tsx', 'r') as f:
    text = f.read()

# Make the metric cards grid less clustered - 3 columns instead of 6
old_grid = """<div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginBottom: 12 }}>"""
new_grid = """<div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>"""
text = text.replace(old_grid, new_grid)

# Update Health colors to be Cyan (#457CB8) and Purple (#586CBA) instead of Green
text = text.replace(
    """const sc = (s: number) => s >= 4.5 ? "#22c55e" : s >= 3.5 ? "#84cc16" : s >= 2.5 ? "#f59e0b" : "#ef4444";""",
    """const sc = (s: number) => s >= 4.5 ? "#457CB8" : s >= 3.5 ? "#586CBA" : s >= 2.5 ? "#f59e0b" : "#ef4444";"""
)
text = text.replace(
    """const hc = (h: string) => ({ healthy: "#22c55e", degraded: "#f59e0b", error: "#f97316", critical: "#ef4444" }[h] || "#6b7280");""",
    """const hc = (h: string) => ({ healthy: "#457CB8", degraded: "#f59e0b", error: "#f97316", critical: "#ef4444" }[h] || "rgba(255,255,255,0.4)");"""
)

# Soften the card styles to remove hard borders, making it much cleaner and "world-class"
old_card_comp = """const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "1.1rem 1.25rem", ...style }}>"""
new_card_comp = """const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: T.card, border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", borderRadius: 16, padding: "1.5rem", ...style }}>"""
text = text.replace(old_card_comp, new_card_comp)

# Clean up TopNav border to be softer
text = text.replace(
    """background: "rgba(4,5,7,0.92)", backdropFilter: "blur(12px)",\n      borderBottom: `1px solid ${T.border}`,""",
    """background: "rgba(16, 18, 26, 0.85)", backdropFilter: "blur(20px)",\n      borderBottom: "1px solid rgba(255,255,255,0.05)","""
)

# Also update the Home Nav to match the theme color exactly
text = text.replace(
    """background: "rgba(4,5,7,0.8)", backdropFilter: "blur(12px)",\n            borderBottom: `1px solid ${T.border}`,""",
    """background: "rgba(16, 18, 26, 0.5)", backdropFilter: "blur(20px)",\n            borderBottom: "1px solid rgba(255,255,255,0.05)","""
)
text = text.replace(
    """background: "linear-gradient(to right, #040507 0%, transparent 35%, transparent 100%)",""",
    """background: "linear-gradient(to right, #10121A 0%, transparent 35%, transparent 100%)","""
)

with open('app/page.tsx', 'w') as f:
    f.write(text)
