# Research: Google AI Quota Usage Display

**Feature**: 001-google-ai-usage
**Date**: 2026-03-15
**Status**: Complete — all unknowns resolved

---

## Decision 1: API for Quota Consumption (RPM/TPM/RPD)

**Decision**: Google Cloud Monitoring API (`monitoring.googleapis.com`) via time-series query.

**Rationale**: This is the only programmatic interface that returns actual *consumption* values per model per quota window. The Gemini API itself does not expose remaining quota headers. The Service Usage API returns limits only, not usage.

**Endpoint**:
```
GET https://monitoring.googleapis.com/v3/projects/{project}/timeSeries
  ?filter=metric.type="serviceruntime.googleapis.com/quota/rate/net_usage"
    AND resource.labels.service="generativelanguage.googleapis.com"
  &interval.startTime={ISO - 2 min}
  &interval.endTime={ISO now}
  &aggregation.alignmentPeriod=60s
  &aggregation.perSeriesAligner=ALIGN_RATE
```

For daily (RPD) quota consumption, use `serviceruntime.googleapis.com/quota/allocation/usage`.

The `metric.labels.quota_metric` label in each returned time-series identifies the model and quota type (e.g., `generate-requests-per-minute-per-project-per-model`). The `metric.labels.model` or similar label identifies the specific model. Exact label names must be discovered from live API responses during implementation, as Google does not document them with guaranteed stability.

**Alternatives considered**:
- Gemini API response headers: Does not exist — Gemini API returns 429 on exhaustion but no remaining-quota headers.
- Client-side request counting: Fragile, inaccurate across sessions, cannot distinguish TPM.
- Google Cloud Console scraping: Brittle, not an API.

---

## Decision 2: API for Quota Limits (Denominators)

**Decision**: Google Cloud Service Usage API (`serviceusage.googleapis.com`) with static Tier 1 fallback.

**Rationale**: The Service Usage API can return the account-specific configured limits for `generativelanguage.googleapis.com`. This allows the panel to show accurate limits even if the user's account has had limits increased. Static fallback ensures the panel works without Service Usage API access.

**Endpoint**:
```
GET https://serviceusage.googleapis.com/v1beta1/projects/{project}/services/generativelanguage.googleapis.com/consumerQuotaMetrics?view=FULL
```

**Static Tier 1 fallback limits** (hard-coded):
| Model | RPM | TPM | RPD |
|---|---|---|---|
| Gemini 2.5 Pro | 150 | 2,000,000 | 1,500 |
| Gemini 2.5 Flash | 300 | 2,000,000 | 1,500 |
| Gemini 2.5 Flash-Lite | 300 | 2,000,000 | 1,500 |
| Gemini 3.x Preview | 150 | 2,000,000 | 250 |

**Alternatives considered**:
- Hard-code only: Simpler but fails for users with custom quota increases.

---

## Decision 3: Authentication

**Decision**: GCP service account via `GOOGLE_APPLICATION_CREDENTIALS` environment variable pointing to a service account JSON key file.

**Rationale**: Matches the pattern used by other GCP tooling. Application Default Credentials (ADC) are also supported as a fallback (enabling `gcloud auth application-default login` for local dev). This approach works in both Docker and local environments. A plain Gemini API key is insufficient — Cloud Monitoring and Service Usage APIs require OAuth2 with GCP IAM scopes.

**Required IAM roles** (minimum):
- `roles/monitoring.viewer` — read quota consumption time-series
- `roles/serviceusage.serviceUsageViewer` — read configured quota limits

**Config env vars**:
- `GOOGLE_APPLICATION_CREDENTIALS` — path to service account JSON (optional if ADC configured)
- `GOOGLE_PROJECT_ID` — GCP project ID (required; no reliable way to auto-detect)

**Alternatives considered**:
- OAuth2 user flow: Adds interactive auth, inappropriate for a server daemon.
- Gemini API key only: Insufficient scope for Cloud Monitoring.

---

## Decision 4: npm Dependency for GCP Auth

**Decision**: Add `google-auth-library` npm package to `server/package.json`.

**Rationale**: GCP OAuth2 service account authentication requires RS256 JWT signing and automatic token refresh. Implementing this from scratch is non-trivial and error-prone. `google-auth-library` is the official Google-maintained library, widely used, and well-maintained. Adds ~200KB to the server bundle — acceptable.

**Complexity tracking entry required**: Yes (per Constitution Principle III).

**Alternatives considered**:
- Manual JWT signing with Node.js `crypto`: Feasible but high maintenance surface.
- `googleapis` full SDK: ~10x heavier, includes unnecessary API client code.
- `node-fetch` + manual token: Same problem as manual JWT signing.

---

## Decision 5: Poll Interval

**Decision**: 60 seconds.

**Rationale**: Google Cloud Monitoring provides quota metrics at 1-minute granularity. Polling faster than 60 seconds wastes API calls without yielding fresher data. Polling the Monitoring API itself counts against the project's Monitoring API quota. 60-second intervals matches the data resolution and keeps monitoring API usage negligible (~1,440 calls/day).

**Alternatives considered**:
- 5 minutes (like `SubscriptionPoller`): Cloud Monitoring data is fresh at 1-min resolution; 5-min polling means data could be 6 minutes stale.
- 30 seconds: Would not produce fresher data, doubles API calls.

---

## Decision 6: Data Freshness Lag

**Decision**: Accept ~1–2 minute lag and display "as of {timestamp}" on the panel.

**Rationale**: Google Cloud Monitoring has an inherent ~1–2 minute ingestion lag between API calls happening and metrics being available. There is no workaround. The panel must make this transparent to users via a displayed timestamp, per Constitution Principle I (stale data must be visually distinguished).

**Implementation**: The `fetchedAt` timestamp is shown on the panel (same as Claude `SubscriptionUsage`). The panel never shows a "live" indicator for Google AI data — it shows "Updated HH:MM:SS" format.

---

## Decision 7: Model Display Strategy

**Decision**: Always display all 4 supported model rows; dim/collapse models with zero utilization.

**Rationale**: Chosen by user (Option C). Provides full context at a glance while reducing visual noise when few models are active. Models with 0% utilization are rendered at reduced opacity (matching `text-idle` / `text-steel` color classes used elsewhere in the dashboard).

---

## Decision 8: "Not Configured" State

**Decision**: Show a distinct panel state with setup instructions when `GOOGLE_PROJECT_ID` is absent or credentials are invalid.

**Rationale**: The feature is optional — users who don't use Gemini shouldn't see a broken panel. Constitution Principle IV requires unambiguous UI states. The "not configured" state must be visually distinct from "configured + error" and "configured + loading".

**State matrix for `GoogleAIUsage` component**:
| State | Condition | Visual Treatment |
|---|---|---|
| Not Configured | `configured: false` in API response | Muted panel, setup instruction text |
| Loading | `configured: true`, no data yet | Skeleton bars (same opacity animation as loading) |
| Configured + Data | `data.models` present | Normal utilization bars per model |
| Configured + Error | `error` non-null, no data | Error banner (same as `SubscriptionUsage` error state) |
| Configured + Cached | `error` non-null, stale data present | Normal bars + "(cached)" indicator |
