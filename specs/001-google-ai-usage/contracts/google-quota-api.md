# API Contract: Google AI Quota Endpoint

**Feature**: 001-google-ai-usage
**Date**: 2026-03-15

---

## REST Endpoint

### `GET /api/google-quota`

Returns current Google AI (Gemini) quota consumption and limits for all supported models.

#### Response Shape

```json
{
  "configured": true,
  "fetchedAt": "2026-03-15T15:41:00.000Z",
  "error": null,
  "data": {
    "models": [
      {
        "id": "gemini-2.5-pro",
        "displayName": "Gemini 2.5 Pro",
        "tier": "stable",
        "rpm": {
          "used": 42,
          "limit": 150,
          "utilization": 28.0,
          "windowResetsAt": "2026-03-15T15:42:00.000Z",
          "limitSource": "api"
        },
        "tpm": {
          "used": 450000,
          "limit": 2000000,
          "utilization": 22.5,
          "windowResetsAt": "2026-03-15T15:42:00.000Z",
          "limitSource": "fallback"
        },
        "rpd": {
          "used": 230,
          "limit": 1500,
          "utilization": 15.3,
          "windowResetsAt": "2026-03-16T00:00:00.000Z",
          "limitSource": "api"
        }
      },
      {
        "id": "gemini-2.5-flash",
        "displayName": "Gemini 2.5 Flash",
        "tier": "stable",
        "rpm": { "used": 0, "limit": 300, "utilization": 0, "windowResetsAt": "2026-03-15T15:42:00.000Z", "limitSource": "fallback" },
        "tpm": { "used": 0, "limit": 2000000, "utilization": 0, "windowResetsAt": "2026-03-15T15:42:00.000Z", "limitSource": "fallback" },
        "rpd": { "used": 0, "limit": 1500, "utilization": 0, "windowResetsAt": "2026-03-16T00:00:00.000Z", "limitSource": "fallback" }
      },
      {
        "id": "gemini-2.5-flash-lite",
        "displayName": "Gemini 2.5 Flash-Lite",
        "tier": "stable",
        "rpm": { "used": 0, "limit": 300, "utilization": 0, "windowResetsAt": "2026-03-15T15:42:00.000Z", "limitSource": "fallback" },
        "tpm": { "used": 0, "limit": 2000000, "utilization": 0, "windowResetsAt": "2026-03-15T15:42:00.000Z", "limitSource": "fallback" },
        "rpd": { "used": 0, "limit": 1500, "utilization": 0, "windowResetsAt": "2026-03-16T00:00:00.000Z", "limitSource": "fallback" }
      },
      {
        "id": "gemini-3-preview",
        "displayName": "Gemini 3.x Preview",
        "tier": "preview",
        "rpm": { "used": 0, "limit": 150, "utilization": 0, "windowResetsAt": "2026-03-15T15:42:00.000Z", "limitSource": "fallback" },
        "tpm": { "used": 0, "limit": 2000000, "utilization": 0, "windowResetsAt": "2026-03-15T15:42:00.000Z", "limitSource": "fallback" },
        "rpd": { "used": 0, "limit": 250, "utilization": 0, "windowResetsAt": "2026-03-16T00:00:00.000Z", "limitSource": "fallback" }
      }
    ]
  }
}
```

#### Not Configured Response

When `GOOGLE_PROJECT_ID` is absent or credentials are invalid/missing:

```json
{
  "configured": false,
  "fetchedAt": "2026-03-15T15:41:00.000Z",
  "error": "GOOGLE_PROJECT_ID environment variable not set",
  "data": null
}
```

#### Configured + Error (with Cached Data) Response

When the last poll failed but cached data is available:

```json
{
  "configured": true,
  "fetchedAt": "2026-03-15T15:36:00.000Z",
  "error": "API 403: Permission denied on monitoring.timeSeries.list",
  "data": { "models": [ /* ...last successful data... */ ] }
}
```

#### HTTP Status Codes

| Status | Condition |
|---|---|
| `200` | Always — including error and unconfigured states. Errors are communicated in the response body, not via HTTP status. |

---

## WebSocket Event

### `google-quota:update`

Broadcast to all connected dashboard clients when poll data changes.

```json
{
  "type": "google-quota:update",
  "data": {
    "configured": true,
    "fetchedAt": "2026-03-15T15:41:00.000Z",
    "error": null,
    "data": { "models": [ /* ...same as REST response... */ ] }
  },
  "timestamp": "2026-03-15T15:41:00.000Z"
}
```

This event is only broadcast when the data actually changes (same pattern as `subscription:update`).

---

## WebSocket `init` Payload Extension

The existing `init` message sent on WebSocket connect is extended to include the Google quota state:

```json
{
  "type": "init",
  "data": {
    "agents": [],
    "activities": [],
    "subscription": { /* ...existing Claude subscription data... */ },
    "googleQuota": {
      "configured": true,
      "fetchedAt": "...",
      "error": null,
      "data": { "models": [] }
    }
  }
}
```
