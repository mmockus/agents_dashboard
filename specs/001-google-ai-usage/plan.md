# Implementation Plan: Google AI Quota Usage Display

**Branch**: `001-google-ai-usage` | **Date**: 2026-03-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-google-ai-usage/spec.md`

## Summary

Add a Google AI Quota Usage panel to the agents dashboard sidebar, displaying RPM/TPM/RPD consumption per Gemini model (2.5 Pro, 2.5 Flash, 2.5 Flash-Lite, 3.x Preview). The server polls Google Cloud Monitoring API every 60 seconds using a GCP service account, broadcasts updates via WebSocket, and exposes a `GET /api/google-quota` endpoint. The frontend renders a new `GoogleAIUsage` component styled consistently with the existing `SubscriptionUsage` panel. All 4 models are always shown; idle models are visually dimmed.

## Technical Context

**Language/Version**: JavaScript ES Modules (Node.js 20+) + React 18 + JSX
**Primary Dependencies**: Express, ws, Framer Motion, Tailwind CSS (existing) + `google-auth-library` (new, server only)
**Storage**: In-memory (ephemeral) — existing pattern; no new persistence
**Testing**: Manual end-to-end (existing project pattern — no automated test suite)
**Target Platform**: macOS local dev + Docker (same as existing server)
**Project Type**: Web application (React frontend + Node.js/Express backend)
**Performance Goals**: Quota panel loads within 5 seconds of page open; poll completes within 3 seconds
**Constraints**: 60-second minimum poll interval (Cloud Monitoring data resolution); ~1–2 min data lag (GCP ingestion)
**Scale/Scope**: Single-user local dashboard; no concurrency concerns

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Real-Time Observability | ✅ PASS | Cloud Monitoring is polling-only (no push) — explicitly permitted by constitution for data sources without push support. TTL displayed via `fetchedAt` timestamp. Stale data shown with "(cached)" indicator per constitution requirement. |
| II. Hooks-Driven Telemetry | ✅ PASS | This feature governs quota monitoring data, not agent lifecycle events. Agent state continues to originate exclusively from hook events. No constitution conflict. |
| III. Simplicity First | ⚠️ JUSTIFIED VIOLATION | Adding `google-auth-library` npm dependency (see Complexity Tracking). No new persistence, caching tier, or database. Poller follows identical pattern to `SubscriptionPoller`. |
| IV. Unambiguous UI States | ✅ PASS | State matrix defined in research.md: Not Configured / Loading / Data / Cached+Error / Error. Each state has distinct visual treatment. |
| V. Provider Agnosticism | ✅ PASS | Google-specific logic is isolated to `server/googleAIQuotaPoller.js` (adapter module). Core WebSocket schema, agent lifecycle, and data model are unchanged. Frontend component follows same provider-isolation pattern as `SubscriptionUsage`. |

## Project Structure

### Documentation (this feature)

```text
specs/001-google-ai-usage/
├── plan.md              ← this file
├── spec.md
├── research.md          ✅ complete
├── data-model.md        ✅ complete
├── quickstart.md        ✅ complete
├── contracts/
│   └── google-quota-api.md  ✅ complete
└── tasks.md             (Phase 2 — /speckit.tasks command)
```

### Source Code (repository root)

```text
server/
├── index.js                    ← extend: add /api/google-quota endpoint, init GoogleAIQuotaPoller, extend WS init message
├── googleAIQuotaPoller.js      ← new: GCP Cloud Monitoring poller (mirrors subscriptionPoller.js)
└── package.json                ← extend: add google-auth-library dependency

src/
├── api/
│   └── telemetry.js            ← extend: add getGoogleQuota() method
├── components/
│   ├── GoogleAIUsage.jsx       ← new: quota display panel (mirrors SubscriptionUsage.jsx structure)
│   └── SubscriptionUsage.jsx   ← no change
├── hooks/
│   └── useAgentData.js         ← extend: add googleQuota state + google-quota:update WS handler
└── App.jsx                     ← extend: render <GoogleAIUsage> in sidebar below <SubscriptionUsage>
```

**Structure Decision**: Single-project web app (Option 2 from template). Existing `backend/` maps to `server/`, existing `frontend/` maps to `src/`. All new files follow the established `server/*.js` and `src/components/*.jsx` conventions.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New npm dependency: `google-auth-library` | GCP OAuth2 service account authentication requires RS256 JWT signing + automatic token refresh. Required to call Cloud Monitoring and Service Usage APIs. | Manual JWT signing via `crypto`: non-trivial, error-prone, high ongoing maintenance. Full `googleapis` SDK: ~10x bundle weight with unused API clients. No viable zero-dependency alternative. |

---

## Implementation Phases

### Phase 1A: Server — GoogleAIQuotaPoller

Create `server/googleAIQuotaPoller.js` modeling it after `server/subscriptionPoller.js`. The poller:

1. Reads config from `GOOGLE_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS` env vars.
2. If unconfigured, immediately returns `{ configured: false }` state and stops.
3. Acquires a GCP OAuth2 access token via `google-auth-library` (`GoogleAuth` class with `monitoring.read` scope).
4. On each poll (60-second interval):
   a. Fetches quota consumption from Cloud Monitoring API (`serviceruntime.googleapis.com/quota/rate/net_usage` and `quota/allocation/usage`) for `generativelanguage.googleapis.com`.
   b. Fetches quota limits from Service Usage API (or uses static fallback if unavailable).
   c. Maps time-series label values to the 4 model registry entries.
   d. Computes `utilization` percentages and `windowResetsAt` timestamps.
   e. Calls `this.onUpdate(payload)` when data changes.
5. Exposes `getQuota()` for REST endpoint use.
6. Handles auth errors, network errors, and 404/403 responses gracefully.

**Key implementation note**: The exact `quota_metric` label values in Cloud Monitoring responses must be discovered at runtime — log them on first successful fetch so the model-mapping logic can be calibrated. Implement with a label-matching approach (e.g., contains `"pro"`, contains `"flash-lite"`) rather than exact string equality.

### Phase 1B: Server — index.js Extensions

1. Import and initialize `GoogleAIQuotaPoller` with the `broadcast` callback.
2. Add `GET /api/google-quota` endpoint returning `googleAIQuotaPoller.getQuota()`.
3. Extend WebSocket `init` message to include `googleQuota: googleAIQuotaPoller.getQuota()`.
4. Add `google-auth-library` to `server/package.json`.

### Phase 1C: Frontend — telemetry.js Extension

Add `getGoogleQuota()` method to `src/api/telemetry.js`:
```js
getGoogleQuota: () => fetchJson('/api/google-quota')
```

### Phase 1D: Frontend — useAgentData.js Extension

1. Add `googleQuota` state with `null` initial value.
2. In `fetchData()`, include `telemetry.getGoogleQuota()` in the `Promise.all`.
3. In `handleMessage()`, add case for `'google-quota:update'` → `setGoogleQuota(message.data)`.
4. In WebSocket `'init'` handler, set `googleQuota` from `message.data.googleQuota`.
5. Return `googleQuota` from the hook.

### Phase 1E: Frontend — GoogleAIUsage.jsx

New component mirroring the structure of `SubscriptionUsage.jsx`.

**Visual states** (per research.md state matrix):
- **Not Configured**: Muted panel with Google AI icon, text "Configure GOOGLE_PROJECT_ID to enable", no bars.
- **Loading**: Header visible, bars rendered as grey skeleton placeholders.
- **Configured + Data**: Full panel with 4 model sections; idle models (all 3 metrics = 0%) rendered at reduced opacity.
- **Configured + Error (no cache)**: Error banner with message, no bars.
- **Configured + Cached**: Normal bars with "(cached)" tag in footer + `fetchedAt` timestamp.

**Model section structure**: Each of the 4 models renders as a sub-section with:
- Model name header + preview badge (for tier=preview) + collapse/expand if idle
- Three `UsageBar` rows: RPM, TPM, RPD
- Each bar shows: label, `used / limit` raw count, percentage, utilization bar, reset countdown

**Color conventions**: Reuse `getUtilizationColor()` logic from `SubscriptionUsage.jsx`. Apply `text-gemini` accent color (already in Tailwind config) for the panel header icon.

### Phase 1F: Frontend — App.jsx Extension

In the sidebar `div.space-y-6`, add `<GoogleAIUsage googleQuota={liveGoogleQuota} />` immediately below `<SubscriptionUsage subscription={liveSubscription} />`. Import `useAgentData` hook's new `googleQuota` return value.

---

## Post-Design Constitution Re-Check

| Principle | Post-Design Status | Notes |
|---|---|---|
| I. Real-Time Observability | ✅ PASS | WebSocket push on data change; `fetchedAt` displayed; "(cached)" label when stale. Consistent with subscription panel treatment. |
| II. Hooks-Driven Telemetry | ✅ PASS | No agent state touched. Quota data is a separate polling concern, same as Claude subscription. |
| III. Simplicity First | ✅ DOCUMENTED | One justified dependency addition. `GoogleAIQuotaPoller` is ~120 lines, no abstraction beyond what's needed. |
| IV. Unambiguous UI States | ✅ PASS | 5 distinct states, each with unique visual treatment defined in Phase 1E. |
| V. Provider Agnosticism | ✅ PASS | `googleAIQuotaPoller.js` is a standalone adapter. `index.js` additions are additive. Core agent event schema unchanged. |
