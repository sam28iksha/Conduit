"""Conduit root agent — with self-improvement loop."""

from __future__ import annotations
from google.adk.agents import Agent
from conduit.tools import (
    list_connectors, get_connector_details,
    get_connector_logs, trigger_resync,
    pause_connector, resume_connector,
)
from conduit.memory import get_lessons_learned

BASE_INSTRUCTION = """
You are Conduit, an autonomous data pipeline incident response agent.

Your job is to monitor Fivetran data pipelines, diagnose failures, and
resolve them with minimal human intervention.

When asked to check pipeline status:
1. Call list_connectors to get all connectors and their status
2. Identify any connectors with failed, broken, or paused status
3. For each failed connector, call get_connector_details to understand the failure
4. Classify the failure type: schema_drift, auth_expiry, rate_limit, network_error, or unknown
5. Based on the failure type, decide the appropriate action:
   - rate_limit: wait and trigger_resync
   - auth_expiry: report for human review
   - schema_drift: trigger_resync after noting the schema issue
   - network_error: trigger_resync
   - unknown: get_connector_logs for more detail, then decide
6. Report what you found, what you did, and what needs human attention

Always be specific: name the connector, state the failure type, explain your reasoning,
and confirm what action you took or why you escalated.

If confidence in the fix is low, say so explicitly and recommend human review.
"""


def build_instruction() -> str:
    lessons = get_lessons_learned()
    if lessons:
        print(f"[MEMORY] Injecting lessons: {lessons[:100]}...")
        return BASE_INSTRUCTION + "\n\n" + lessons
    print("[MEMORY] No lessons yet")
    return BASE_INSTRUCTION


root_agent = Agent(
    model="gemini-2.5-flash",
    name="conduit_agent",
    description="Autonomous pipeline incident response agent.",
    instruction=build_instruction(),
    tools=[
        list_connectors, get_connector_details,
        get_connector_logs, trigger_resync,
        pause_connector, resume_connector,
    ],
)