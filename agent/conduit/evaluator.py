"""LLM-as-a-Judge evaluator for Conduit agent decisions."""

from __future__ import annotations

import os
import json
from google import genai
from google.genai import types


def get_gemini_client():
    print("PROJECT:", os.environ.get("GOOGLE_CLOUD_PROJECT"))
    print("LOCATION:", os.environ.get("GOOGLE_CLOUD_LOCATION"))
    print("VERTEX:", os.environ.get("GOOGLE_GENAI_USE_VERTEXAI"))
    return genai.Client(
        vertexai=True,
        project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
        location=os.environ.get("GOOGLE_CLOUD_LOCATION"),
    )


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
CRITICAL: key_finding and improvement_suggestion must be single-line strings with no newlines.
"""


def evaluate_agent_run(trace_text: str, incident_id: str) -> dict:
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
        raw = response.text.strip()

        # Strip markdown fences
        if "```" in raw:
            parts = raw.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                if part.startswith("{"):
                    raw = part
                    break

        # Find the JSON object boundaries — handles leading/trailing text
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON object found in response")
        raw = raw[start:end]

        # Remove literal newlines inside JSON string values
        # (Gemini sometimes wraps long strings with actual \n)
        import re
        # Replace unescaped newlines inside quoted strings
        raw = re.sub(r'(?<!\\)\n', ' ', raw)
        # Remove control characters that break JSON
        raw = re.sub(r'[\x00-\x1f\x7f]', ' ', raw)

        scores = json.loads(raw)
        scores["incident_id"] = incident_id
        return scores

    except Exception as e:
        print(f"[EVAL ERROR] {type(e).__name__}: {e}")
        return {
            "incident_id": incident_id,
            "error": str(e),
            "overall_score": 0,
            "key_finding": "Evaluation failed",
            "improvement_suggestion": "Check evaluator configuration"
        }
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