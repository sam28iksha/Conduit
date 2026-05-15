"""Fivetran REST API tools for the Conduit agent."""

from __future__ import annotations

import os
import requests
from typing import Any

FIVETRAN_BASE = "https://api.fivetran.com/v1"


def _headers() -> dict:
    import base64
    api_key = os.environ.get('FIVETRAN_API_KEY', '')
    api_secret = os.environ.get('FIVETRAN_API_SECRET', '')
    credentials = f"{api_key}:{api_secret}"
    encoded = base64.b64encode(credentials.encode('utf-8')).decode('ascii')
    return {
        "Authorization": f"Basic {encoded}",
        "Content-Type": "application/json",
    }


def list_connectors() -> dict[str, Any]:
    """List all Fivetran connectors and their current sync status."""
    try:
        response = requests.get(
            f"{FIVETRAN_BASE}/connectors",
            headers=_headers(),
            timeout=10,
        )
        return response.json()
    except Exception as e:
        return {"error": str(e), "code": "CONNECTION_FAILED"}


def get_connector_details(connector_id: str) -> dict[str, Any]:
    """Get full details and recent sync status for a specific connector."""
    try:
        response = requests.get(
            f"{FIVETRAN_BASE}/connectors/{connector_id}",
            headers=_headers(),
            timeout=10,
        )
        return response.json()
    except Exception as e:
        return {"error": str(e), "connector_id": connector_id}


def get_connector_logs(connector_id: str) -> dict[str, Any]:
    """Get recent sync logs for a connector to diagnose failures."""
    try:
        response = requests.get(
            f"{FIVETRAN_BASE}/connectors/{connector_id}/logs",
            headers=_headers(),
            timeout=10,
        )
        return response.json()
    except Exception as e:
        return {"error": str(e), "connector_id": connector_id}


def trigger_resync(connector_id: str) -> dict[str, Any]:
    """Trigger a manual re-sync for a failed connector."""
    try:
        response = requests.post(
            f"{FIVETRAN_BASE}/connectors/{connector_id}/sync",
            headers=_headers(),
            timeout=10,
        )
        return response.json()
    except Exception as e:
        return {"error": str(e), "connector_id": connector_id}


def pause_connector(connector_id: str) -> dict[str, Any]:
    """Pause a connector that is causing repeated failures."""
    try:
        response = requests.patch(
            f"{FIVETRAN_BASE}/connectors/{connector_id}",
            headers=_headers(),
            json={"paused": True},
            timeout=10,
        )
        return response.json()
    except Exception as e:
        return {"error": str(e), "connector_id": connector_id}


def resume_connector(connector_id: str) -> dict[str, Any]:
    """Resume a previously paused connector."""
    try:
        response = requests.patch(
            f"{FIVETRAN_BASE}/connectors/{connector_id}",
            headers=_headers(),
            json={"paused": False},
            timeout=10,
        )
        return response.json()
    except Exception as e:
        return {"error": str(e), "connector_id": connector_id}