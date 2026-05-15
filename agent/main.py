# Copyright 2025 Google LLC
# Licensed under the Apache License, Version 2.0

"""Conduit: Autonomous pipeline incident response agent."""

from __future__ import annotations

import asyncio
import secrets
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from google.adk.runners import InMemoryRunner
from google.genai import types

from instrumentation import setup_tracing
from conduit.agent import root_agent


async def run_turn(user_text: str) -> None:
    setup_tracing()
    app_name = "conduit"
    user_id = "local_user"
    session_id = secrets.token_hex(8)

    runner = InMemoryRunner(agent=root_agent, app_name=app_name)
    await runner.session_service.create_session(
        app_name=app_name, user_id=user_id, session_id=session_id
    )

    print(f"\n[Conduit] Processing: {user_text}\n")

    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=types.Content(
            role="user", parts=[types.Part(text=user_text)]
        ),
    ):
        # Print agent responses as they stream in
        if event.content and event.content.parts:
            for part in event.content.parts:
                if hasattr(part, "text") and part.text:
                    print(part.text, end="", flush=True)
    print("\n")


def main() -> None:
    msg = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "Check all pipeline connectors and report their current status."
    )
    asyncio.run(run_turn(msg))


if __name__ == "__main__":
    main()