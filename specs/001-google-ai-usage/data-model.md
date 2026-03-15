# Data Model: Google AI Quota Usage Display

**Feature**: 001-google-ai-usage
**Date**: 2026-03-15

---

## Entities

### GeminiModelQuota

Represents the current quota state for a single Gemini model, including both limits and consumption across all three quota dimensions.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Model identifier slug (e.g., `"gemini-2.5-pro"`) |
| `displayName` | `string` | Human-readable model name (e.g., `"Gemini 2.5 Pro"`) |
| `tier` | `"stable" \| "preview"` | Determines RPD limit category; preview models show warning indicator |
| `rpm` | `QuotaMetric` | Requests-per-minute quota window |
| `tpm` | `QuotaMetric` | Tokens-per-minute quota window |
| `rpd` | `QuotaMetric` | Requests-per-day quota window |

### QuotaMetric

A single quota dimension (e.g., RPM) for a given model.

| Field | Type | Description |
|---|---|---|
| `used` | `number` | Current consumption in this window (raw count) |
| `limit` | `number` | Maximum allowed in this window (from API or static fallback) |
| `utilization` | `number` | `used / limit * 100`, clamped to [0, 100] |
| `windowResetsAt` | `string \| null` | ISO 8601 timestamp when this window resets; null if unknown |
| `limitSource` | `"api" \| "fallback"` | Whether limit came from Service Usage API or static fallback |

### GoogleQuotaPayload

The full payload returned by `/api/google-quota` and broadcast via WebSocket `google-quota:update`.

| Field | Type | Description |
|---|---|---|
| `configured` | `boolean` | False when `GOOGLE_PROJECT_ID` is missing or credentials are invalid |
| `data` | `{ models: GeminiModelQuota[] } \| null` | Quota data per model; null when unconfigured or first-fetch pending |
| `error` | `string \| null` | Error message if last fetch failed; non-null does not mean data is absent (cached data may still be present) |
| `fetchedAt` | `string \| null` | ISO 8601 timestamp of last successful or attempted fetch |

---

## Supported Models (Static Registry)

The poller maintains a static registry of supported models. This registry defines display names, tier classification, and Tier 1 fallback limits.

```js
const MODEL_REGISTRY = [
  {
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    tier: 'stable',
    fallbackLimits: { rpm: 150, tpm: 2_000_000, rpd: 1_500 }
  },
  {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    tier: 'stable',
    fallbackLimits: { rpm: 300, tpm: 2_000_000, rpd: 1_500 }
  },
  {
    id: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash-Lite',
    tier: 'stable',
    fallbackLimits: { rpm: 300, tpm: 2_000_000, rpd: 1_500 }
  },
  {
    id: 'gemini-3-preview',
    displayName: 'Gemini 3.x Preview',
    tier: 'preview',
    fallbackLimits: { rpm: 150, tpm: 2_000_000, rpd: 250 }
  }
]
```

Note: GCP quota metric label names for these models must be discovered from the Cloud Monitoring API response during implementation. The `id` fields in this registry must be mapped to the label values returned by the API.

---

## State Transitions

```
[unconfigured] ──env vars set──→ [configured:loading]
                                        │
                                 fetch succeeds
                                        │
                                        ▼
                              [configured:data]
                                        │
                             ┌──────────┼──────────┐
                          poll fails  poll ok  poll fails
                             │          │       (no cache)
                             ▼          ▼           ▼
                     [configured:  [configured: [configured:
                      cached+err]    data]        error]
```

---

## Validation Rules

- `utilization` must never exceed 100 in the API response (clamped server-side).
- `used` must be `>= 0`; negative values from the monitoring API are treated as 0.
- `limit` must be `> 0`; if limit cannot be determined, `utilization` is omitted and the raw `used` count is shown.
- `windowResetsAt` for RPM: computed as start of next 60-second UTC window.
- `windowResetsAt` for RPD: midnight UTC of the current calendar day.
