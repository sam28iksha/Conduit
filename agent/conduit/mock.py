"""
Realistic Fivetran API mock responses for Conduit demo.
Response shapes mirror the real Fivetran v1 API exactly.
Switch between real and mock by setting USE_MOCK_DATA=true in .env
"""

from __future__ import annotations

MOCK_CONNECTORS_RESPONSE = {
    "code": "Success",
    "message": "Connections list retrieved successfully",
    "data": {
        "items": [
            {
                "id": "salesforce_prod_001",
                "group_id": "warehouse_group",
                "service": "salesforce",
                "service_version": 2,
                "schema": "salesforce_production",
                "connected_by": "admin_user",
                "created_at": "2025-11-01T09:00:00.000000Z",
                "succeeded_at": "2026-05-18T14:00:00.000000Z",
                "failed_at": "2026-05-19T21:03:00.000000Z",
                "paused": False,
                "pause_after_trial": False,
                "sync_frequency": 360,
                "schedule_type": "auto",
                "status": {
                    "setup_state": "connected",
                    "schema_status": "broken",
                    "sync_state": "error",
                    "update_state": "delayed",
                    "is_historical_sync": False,
                    "tasks": [
                        {
                            "code": "schema_change_handling",
                            "message": "Breaking schema change detected: field 'opportunity_stage_v2' (REQUIRED, STRING) added to Opportunity object. 14,832 rows affected. Sync aborted pending schema approval."
                        }
                    ],
                    "warnings": [
                        {
                            "code": "stale_data",
                            "message": "Downstream tables may contain stale data. Last successful sync was 7 hours ago."
                        }
                    ]
                }
            },
            {
                "id": "stripe_payments_002",
                "group_id": "warehouse_group",
                "service": "stripe",
                "service_version": 1,
                "schema": "stripe_payments",
                "connected_by": "admin_user",
                "created_at": "2025-10-15T10:00:00.000000Z",
                "succeeded_at": "2026-05-19T16:00:00.000000Z",
                "failed_at": "2026-05-19T22:15:00.000000Z",
                "paused": False,
                "pause_after_trial": False,
                "sync_frequency": 180,
                "schedule_type": "auto",
                "status": {
                    "setup_state": "connected",
                    "schema_status": "ready",
                    "sync_state": "error",
                    "update_state": "delayed",
                    "is_historical_sync": False,
                    "tasks": [
                        {
                            "code": "rate_limit",
                            "message": "429 Too Many Requests: Stripe API rate limit exceeded. Retry-After: 60 seconds. Requests in window: 1000/1000."
                        }
                    ],
                    "warnings": []
                }
            },
            {
                "id": "postgres_analytics_003",
                "group_id": "warehouse_group",
                "service": "postgres",
                "service_version": 3,
                "schema": "analytics_warehouse",
                "connected_by": "admin_user",
                "created_at": "2025-09-01T08:00:00.000000Z",
                "succeeded_at": "2026-05-18T20:00:00.000000Z",
                "failed_at": "2026-05-19T08:00:00.000000Z",
                "paused": True,
                "pause_after_trial": False,
                "sync_frequency": 1440,
                "schedule_type": "auto",
                "status": {
                    "setup_state": "connected",
                    "schema_status": "ready",
                    "sync_state": "paused",
                    "update_state": "delayed",
                    "is_historical_sync": False,
                    "tasks": [
                        {
                            "code": "auth_failed",
                            "message": "Authentication failed: FATAL password authentication failed for user 'fivetran_reader'. Credentials may have been rotated. Please update connection credentials in Fivetran."
                        }
                    ],
                    "warnings": []
                }
            },
            {
                "id": "hubspot_crm_004",
                "group_id": "warehouse_group",
                "service": "hubspot",
                "service_version": 2,
                "schema": "hubspot_crm",
                "connected_by": "admin_user",
                "created_at": "2025-12-01T11:00:00.000000Z",
                "succeeded_at": "2026-05-19T23:45:00.000000Z",
                "failed_at": None,
                "paused": False,
                "pause_after_trial": False,
                "sync_frequency": 60,
                "schedule_type": "auto",
                "status": {
                    "setup_state": "connected",
                    "schema_status": "ready",
                    "sync_state": "scheduled",
                    "update_state": "on_schedule",
                    "is_historical_sync": False,
                    "tasks": [],
                    "warnings": []
                }
            },
            {
                "id": "bigquery_export_005",
                "group_id": "warehouse_group",
                "service": "google_analytics_4",
                "service_version": 1,
                "schema": "ga4_analytics",
                "connected_by": "admin_user",
                "created_at": "2026-01-10T09:00:00.000000Z",
                "succeeded_at": "2026-05-19T23:30:00.000000Z",
                "failed_at": None,
                "paused": False,
                "pause_after_trial": False,
                "sync_frequency": 30,
                "schedule_type": "auto",
                "status": {
                    "setup_state": "connected",
                    "schema_status": "ready",
                    "sync_state": "scheduled",
                    "update_state": "on_schedule",
                    "is_historical_sync": False,
                    "tasks": [],
                    "warnings": []
                }
            }
        ]
    }
}

MOCK_CONNECTOR_DETAILS = {
    "salesforce_prod_001": {
        "code": "Success",
        "data": MOCK_CONNECTORS_RESPONSE["data"]["items"][0]
    },
    "stripe_payments_002": {
        "code": "Success",
        "data": MOCK_CONNECTORS_RESPONSE["data"]["items"][1]
    },
    "postgres_analytics_003": {
        "code": "Success",
        "data": MOCK_CONNECTORS_RESPONSE["data"]["items"][2]
    },
    "hubspot_crm_004": {
        "code": "Success",
        "data": MOCK_CONNECTORS_RESPONSE["data"]["items"][3]
    },
    "bigquery_export_005": {
        "code": "Success",
        "data": MOCK_CONNECTORS_RESPONSE["data"]["items"][4]
    }
}

MOCK_LOGS = {
    "salesforce_prod_001": {
        "code": "Success",
        "data": {
            "items": [
                {
                    "created_at": "2026-05-19T21:03:47Z",
                    "type": "SEVERE",
                    "message": "Schema change aborted sync: Opportunity.opportunity_stage_v2 (REQUIRED STRING) is new and has no mapping."
                },
                {
                    "created_at": "2026-05-19T21:03:45Z",
                    "type": "WARNING",
                    "message": "Detected 1 new required field in Opportunity schema."
                },
                {
                    "created_at": "2026-05-19T21:03:01Z",
                    "type": "INFO",
                    "message": "Sync started. Target table: salesforce_production.opportunity"
                },
                {
                    "created_at": "2026-05-19T14:00:22Z",
                    "type": "INFO",
                    "message": "Sync completed successfully. 14,832 rows synced to salesforce_production.opportunity."
                },
                {
                    "created_at": "2026-05-19T08:00:11Z",
                    "type": "INFO",
                    "message": "Sync completed successfully. 9,441 rows synced."
                }
            ]
        }
    },
    "stripe_payments_002": {
        "code": "Success",
        "data": {
            "items": [
                {
                    "created_at": "2026-05-19T22:15:33Z",
                    "type": "SEVERE",
                    "message": "HTTP 429: Rate limit exceeded. Stripe returned Retry-After: 60s header."
                },
                {
                    "created_at": "2026-05-19T22:15:29Z",
                    "type": "WARNING",
                    "message": "Request volume approaching rate limit threshold (950/1000 requests)."
                },
                {
                    "created_at": "2026-05-19T16:00:05Z",
                    "type": "INFO",
                    "message": "Sync completed. 3,241 payment records synced. Charges, subscriptions, invoices updated."
                }
            ]
        }
    },
    "postgres_analytics_003": {
        "code": "Success",
        "data": {
            "items": [
                {
                    "created_at": "2026-05-19T08:00:14Z",
                    "type": "SEVERE",
                    "message": "FATAL: password authentication failed for user 'fivetran_reader'. Connection refused."
                },
                {
                    "created_at": "2026-05-18T20:00:31Z",
                    "type": "INFO",
                    "message": "Sync completed. 287,441 rows synced across 12 tables."
                }
            ]
        }
    },
    "hubspot_crm_004": {
        "code": "Success",
        "data": {"items": [
            {"created_at": "2026-05-19T23:45:10Z", "type": "INFO", "message": "Sync completed. 1,847 contacts, 312 deals synced."}
        ]}
    },
    "bigquery_export_005": {
        "code": "Success",
        "data": {"items": [
            {"created_at": "2026-05-19T23:30:05Z", "type": "INFO", "message": "Sync completed. 94,221 GA4 events synced."}
        ]}
    }
}

MOCK_RESYNC_RESPONSE = {
    "code": "Success",
    "message": "Sync has been triggered"
}

MOCK_RESUME_RESPONSE = {
    "code": "Success",
    "message": "Connector has been resumed"
}


def get_mock_connectors() -> dict:
    return MOCK_CONNECTORS_RESPONSE

def get_mock_connector_details(connector_id: str) -> dict:
    return MOCK_CONNECTOR_DETAILS.get(connector_id, {
        "code": "NotFound",
        "message": f"Connector {connector_id} not found"
    })

def get_mock_logs(connector_id: str) -> dict:
    return MOCK_LOGS.get(connector_id, {
        "code": "Success",
        "data": {"items": []}
    })

def get_mock_resync(connector_id: str) -> dict:
    return MOCK_RESYNC_RESPONSE

def get_mock_resume(connector_id: str) -> dict:
    return MOCK_RESUME_RESPONSE

# State tracker — connectors that have been resynced this session
_resynced = set()
_resumed = set()

def get_mock_resync(connector_id: str) -> dict:
    _resynced.add(connector_id)
    return {"code": "Success", "message": "Sync has been triggered"}

def get_mock_connectors() -> dict:
    # Return modified status for resynced connectors
    import copy
    response = copy.deepcopy(MOCK_CONNECTORS_RESPONSE)
    for item in response["data"]["items"]:
        if item["id"] in _resynced:
            item["status"]["sync_state"] = "syncing"
            item["status"]["tasks"] = []
            item["status"]["warnings"] = []
        if item["id"] in _resumed:
            item["paused"] = False
            item["status"]["sync_state"] = "scheduled"
    return response