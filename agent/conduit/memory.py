"""Agent memory: reads past eval scores to improve future decisions."""

from __future__ import annotations
import json
import pathlib
from typing import Optional


SCORES_FILE = pathlib.Path(__file__).parent / "eval_scores.jsonl"


def load_past_scores(limit: int = 10) -> list[dict]:
    """Load the most recent evaluation scores."""
    if not SCORES_FILE.exists():
        return []
    lines = SCORES_FILE.read_text().strip().split("\n")
    scores = []
    for line in lines:
        if line.strip():
            try:
                scores.append(json.loads(line))
            except:
                pass
    return scores[-limit:]  # Most recent N


def get_lessons_learned() -> Optional[str]:
    scores = load_past_scores()
    if not scores:
        return None
    # Filter out failed evaluations and low scores
    low_scores = [s for s in scores 
                  if s.get("overall_score", 5) <= 3 
                  and s.get("key_finding") != "Evaluation failed"]
    if not low_scores:
        return None
    
    lessons = []
    for s in low_scores:
        suggestion = s.get("improvement_suggestion", "")
        finding = s.get("key_finding", "")
        if suggestion:
            lessons.append(f"- Previous finding: {finding}. Suggested fix: {suggestion}")
    
    if not lessons:
        return None
    
    return "LESSONS FROM PAST RUNS (apply these to improve your diagnosis):\n" + "\n".join(lessons)


def get_average_score() -> float:
    """Get average overall score across all runs."""
    scores = load_past_scores(limit=50)
    if not scores:
        return 0.0
    valid = [s["overall_score"] for s in scores if "overall_score" in s and s["overall_score"] > 0]
    return sum(valid) / len(valid) if valid else 0.0