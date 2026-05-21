# Copyright 2025 Google LLC
# Licensed under the Apache License, Version 2.0

"""Conduit: Autonomous pipeline incident response agent."""

from __future__ import annotations

import asyncio
import json
import pathlib
import secrets
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from google.adk.runners import InMemoryRunner
from google.genai import types

from instrumentation import setup_tracing
from conduit.agent import root_agent
from conduit.evaluator import (
    evaluate_agent_run,
    format_trace_for_eval,
)


async def run_turn(user_text: str) -> None:
    setup_tracing()

    app_name = "conduit"
    user_id = "local_user"
    session_id = secrets.token_hex(8)

    runner = InMemoryRunner(
        agent=root_agent,
        app_name=app_name,
    )

    await runner.session_service.create_session(
        app_name=app_name,
        user_id=user_id,
        session_id=session_id,
    )

    print(f"\n[Conduit] Processing: {user_text}\n")

    full_response = []
    tools_called = []

    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=types.Content(
            role="user",
            parts=[types.Part(text=user_text)],
        ),
    ):
        if event.content and event.content.parts:

            for part in event.content.parts:

                # Capture text response
                if hasattr(part, "text") and part.text:
                    print(part.text, end="", flush=True)
                    full_response.append(part.text)

                # Capture tool calls
                if hasattr(part, "function_call") and part.function_call:
                    tools_called.append(part.function_call.name)

    print("\n")

    # Final combined agent output
    agent_output = "".join(full_response)

    # Run evaluator
    if agent_output:

        trace_text = format_trace_for_eval(
            agent_output=agent_output,
            tools_called=tools_called,
            connector_id="detected_from_run",
        )

        try:
            scores = evaluate_agent_run(
                trace_text=trace_text,
                incident_id=session_id,
            )

            print(
                f"\n[Evaluator] Score: "
                f"{scores.get('overall_score', 'N/A')}/5"
            )

            print(
                f"[Evaluator] Finding: "
                f"{scores.get('key_finding', '')}"
            )

            print(
                f"[Evaluator] Suggestion: "
                f"{scores.get('improvement_suggestion', '')}\n"
            )

            # Store scores locally
            scores_file = (
                pathlib.Path(__file__).parent
                / "conduit"
                / "eval_scores.jsonl"
            )

            with open(scores_file, "a") as f:
                f.write(json.dumps(scores) + "\n")

        except Exception as e:
            print(f"\n[Evaluator Error] {e}\n")


async def main():

    if len(sys.argv) < 2:
        print("Usage: python main.py '<message>'")
        return

    user_text = sys.argv[1]

    await run_turn(user_text)


if __name__ == "__main__":
    asyncio.run(main())