"""LLM-as-a-Judge evaluator for Conduit agent decisions."""

from __future__ import annotations

import os
import json
from google import genai
from google.genai import types


def get_gemini_client():
    return genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))


EVAL_PROMPT = """You are an expert evaluator for an autonomous data pipeline incident response agent.

You will be given a trace of an agent's reasoning and actions when responding to a pipeline incident.

Evaluate the agent on these criteria:
1. DIAGNOSIS_ACCURACY (1-5): Did the agent correctly identify the failure type?
2. ACTION_APPROPRIATENESS (1-5): Was the action taken (fix vs escalate) appropriate?
3. REASONING_CLARITY (1-5): Was the reasoning clear and well-explained?
4. ESCALATION_JUDGMENT (1-5): If escalated, was escalation warranted? If fixed, was that safe?

Agent trace:
{trace_text}

Respond ONLY with valid JSON, no markdown, no explanation:

{{
  "diagnosis_accuracy": <1-5>,
  "action_appropriateness": <1-5>,
  "reasoning_clarity": <1-5>,
  "escalation_judgment": <1-5>,
  "overall_score": <1-5>,
  "key_finding": "",
  "improvement_suggestion": ""
}}
"""


def evaluate_agent_run(trace_text: str, incident_id: str) -> dict:
    """Score an agent run using LLM-as-a-Judge."""
    client = get_gemini_client()
    
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=EVAL_PROMPT.format(trace_text=trace_text),
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=2048,
            )
        )
        print(f"[EVAL RAW] {response.text[:200]}")  # Add this line
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        scores = json.loads(raw.strip())
        scores["incident_id"] = incident_id
        return scores
        
    except Exception as e:
        print(f"[EVAL INTERNAL ERROR] {type(e).__name__}: {e}")
        return {
            "incident_id": incident_id,
            "error": str(e),
            "overall_score": 0,
            "key_finding": "Evaluation failed",
            "improvement_suggestion": "Check evaluator configuration"
        }


def format_trace_for_eval(
    agent_output: str,
    tools_called: list[str],
    connector_id: str,
) -> str:
    """Format agent run data into evaluation input."""

    return f"""
CONNECTOR: {connector_id}

TOOLS CALLED:
{", ".join(tools_called)}

AGENT RESPONSE:
{agent_output}
"""