"""Conduit FastAPI backend."""

from __future__ import annotations
import asyncio
import json
import os
import secrets
from pathlib import Path
from typing import AsyncIterator

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "agent"))

from google.adk.runners import InMemoryRunner
from google.genai import types
from instrumentation import setup_tracing

app = FastAPI(title="Conduit API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for SSE streams
stream_queues: dict[str, asyncio.Queue] = {}


class RunRequest(BaseModel):
    message: str = "Check all pipeline connectors and report their current status."


@app.get("/health")
def health():
    return {"status": "ok", "service": "conduit"}


@app.post("/run")
async def run_agent(req: RunRequest):
    """Trigger an agent run and return session_id for streaming."""
    session_id = secrets.token_hex(8)
    queue: asyncio.Queue = asyncio.Queue()
    stream_queues[session_id] = queue
    
    asyncio.create_task(run_agent_task(req.message, session_id, queue))
    return {"session_id": session_id, "status": "started"}


@app.get("/stream/{session_id}")
async def stream_events(session_id: str):
    """Stream agent reasoning via SSE."""
    queue = stream_queues.get(session_id)
    if not queue:
        return {"error": "Session not found"}
    
    async def event_generator() -> AsyncIterator[str]:
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=60.0)
                if event is None:  # Sentinel: stream complete
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
                    break
                yield f"data: {json.dumps(event)}\n\n"
            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/incidents")
def get_incidents():
    """Return past incidents from eval scores file."""
    scores_file = Path(__file__).resolve().parent.parent / "agent" / "conduit" / "eval_scores.jsonl"
    if not scores_file.exists():
        return {"incidents": []}
    lines = scores_file.read_text().strip().split("\n")
    incidents = []
    for line in lines:
        if line.strip():
            try:
                incidents.append(json.loads(line))
            except:
                pass
    return {"incidents": list(reversed(incidents))}


@app.get("/health/score")
def agent_health():
    """Return agent health metrics."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "agent"))
    from conduit.memory import get_average_score, load_past_scores
    scores = load_past_scores(50)
    avg = get_average_score()
    return {
        "average_score": round(avg, 2),
        "total_runs": len(scores),
        "recent_scores": [s.get("overall_score", 0) for s in scores[-10:]]
    }


async def run_agent_task(message: str, session_id: str, queue: asyncio.Queue):
    """Run the agent and push events to the SSE queue."""
    from conduit.agent import root_agent
    
    setup_tracing()
    app_name = "conduit"
    user_id = "api_user"
    
    runner = InMemoryRunner(agent=root_agent, app_name=app_name)
    await runner.session_service.create_session(
        app_name=app_name, user_id=user_id, session_id=session_id
    )
    
    await queue.put({"type": "start", "message": message, "session_id": session_id})
    
    tools_called = []
    full_response = []
    
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=types.Content(role="user", parts=[types.Part(text=message)]),
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if hasattr(part, "text") and part.text:
                    full_response.append(part.text)
                    await queue.put({"type": "text", "content": part.text})
                if hasattr(part, "function_call") and part.function_call:
                    tool_name = part.function_call.name
                    tools_called.append(tool_name)
                    await queue.put({"type": "tool_call", "tool": tool_name})
                if hasattr(part, "function_response") and part.function_response:
                    await queue.put({"type": "tool_result", "tool": part.function_response.name})
    
    # Run evaluator
    agent_output = "".join(full_response)
    if agent_output:
        from conduit.evaluator import evaluate_agent_run, format_trace_for_eval
        trace_text = format_trace_for_eval(agent_output, tools_called, "api_run")
        scores = evaluate_agent_run(trace_text, session_id)
        await queue.put({"type": "eval", "scores": scores})
    
    await queue.put(None)  # Signal stream complete
    stream_queues.pop(session_id, None)