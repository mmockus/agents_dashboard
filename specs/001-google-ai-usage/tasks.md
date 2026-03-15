# Tasks: Google AI Quota Usage Display

**Input**: Design documents from `/specs/001-google-ai-usage/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependency and document configuration requirements

- [x] T001 Add `google-auth-library` to `server/package.json` and run `npm install` inside `server/`
- [x] T002 Add `GOOGLE_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS` env var examples to `server/.env.example` (create file if absent), documenting required GCP IAM roles (`roles/monitoring.viewer`, `roles/serviceusage.serviceUsageViewer`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Server-side poller and data pipeline — MUST be complete before any frontend user story work begins

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create `server/googleAIQuotaPoller.js` implementing the `GoogleAIQuotaPoller` class: read `GOOGLE_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS` env vars; if unconfigured return `{ configured: false }` immediately; acquire GCP OAuth2 access token via `GoogleAuth` from `google-auth-library` with `https://www.googleapis.com/auth/monitoring.read` and `https://www.googleapis.com/auth/cloud-platform.read-only` scopes; on each 60-second poll fetch quota consumption from Cloud Monitoring API (`serviceruntime.googleapis.com/quota/rate/net_usage` and `quota/allocation/usage` metrics filtered to `generativelanguage.googleapis.com`); fetch quota limits from Service Usage API (`serviceusage.googleapis.com/v1beta1/projects/{project}/services/generativelanguage.googleapis.com/consumerQuotaMetrics?view=FULL`); fall back to static Tier 1 limits from `data-model.md` MODEL_REGISTRY if Service Usage API fails; map time-series label values to the 4 model registry entries (gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite, gemini-3-preview); compute `utilization` percentages (clamped 0–100) and `windowResetsAt` timestamps (next 60s UTC boundary for RPM, midnight UTC for RPD); call `this.onUpdate(payload)` only when data changes; expose `getQuota()` method; handle auth errors, 403/404 responses, and network failures gracefully with structured error strings; log discovered `quota_metric` label values on first successful fetch to assist implementation calibration
- [x] T004 Extend `server/index.js`: import and initialize `GoogleAIQuotaPoller` with the `broadcast` callback (same pattern as `SubscriptionPoller`); add `GET /api/google-quota` endpoint returning `googleAIQuotaPoller.getQuota()`; extend the WebSocket `init` message to include `googleQuota: googleAIQuotaPoller.getQuota()` in the `data` object; update the startup banner string to include `GET  /api/google-quota — Google AI quota usage`
- [x] T005 [P] Add `getGoogleQuota()` method to `src/api/telemetry.js` that fetches from `/api/google-quota` using the same `fetchJson` helper used by `getSubscription()`
- [x] T006 Extend `src/hooks/useAgentData.js`: add `googleQuota` state initialized to `null`; add `telemetry.getGoogleQuota()` to the `Promise.all` in `fetchData()` and call `setGoogleQuota(googleQuotaData)`; add `case 'google-quota:update': setGoogleQuota(message.data); break` to the `handleMessage` switch; in the `'init'` case handler set `googleQuota` from `message.data.googleQuota` if present; add `googleQuota` to the hook's return object

**Checkpoint**: `curl http://localhost:3001/api/google-quota` returns a valid JSON payload matching the contract in `contracts/google-quota-api.md`. WebSocket `init` message includes `googleQuota`. Phase complete — user story work can begin.

---

## Phase 3: User Story 1 — View Google AI Quota Usage at a Glance (Priority: P1) 🎯 MVP

**Goal**: A Google AI Quota Usage panel appears in the dashboard sidebar, showing current utilization for Gemini models with color-coded progress bars.

**Independent Test**: Open the dashboard with `GOOGLE_PROJECT_ID` set. The Google AI Quota Usage panel is visible below the Claude Subscription Usage panel. At least one model row shows RPM, TPM, and RPD bars. Color turns amber at 75%+ and red at 90%+. With `GOOGLE_PROJECT_ID` unset, the panel shows a "not configured" message instead of blank.

### Implementation for User Story 1

- [x] T007 [US1] Create `src/components/GoogleAIUsage.jsx` implementing all 5 visual states as defined in `research.md`: (1) **Not Configured** — `configured: false` → muted panel with Google AI icon (use `Sparkles` from lucide-react with `text-gemini` color class), text "Set GOOGLE_PROJECT_ID to enable Google AI quota tracking", no bars; (2) **Error (no cache)** — `error` non-null and `data` null → same error banner pattern as `SubscriptionUsage.jsx` using `AlertTriangle` icon; (3) **Data** — `data.models` present → render panel header with `Sparkles` icon + "Google AI Quota" label, model sections, and `fetchedAt` footer timestamp; (4) **Cached + Error** — `error` non-null but `data` present → render normal bars plus `(cached)` tag in footer; (5) **null/loading** — `googleQuota` prop is null → render nothing (return null), same as `SubscriptionUsage` when subscription is null
- [x] T008 [US1] Inside `GoogleAIUsage.jsx`, implement the `ModelQuotaSection` sub-component: accepts a `GeminiModelQuota` object; renders three `UsageBar` instances — one each for RPM, TPM, RPD; each bar shows label (e.g., "RPM"), `used / limit` raw count formatted with `toLocaleString()`, utilization percentage, and the animated progress bar; reuse the `getUtilizationColor()` logic from `SubscriptionUsage.jsx` (import or inline) with the same color thresholds: green <50%, amber 50–89%, red ≥90%
- [x] T009 [US1] Extend `src/App.jsx`: destructure `googleQuota: liveGoogleQuota` from the `useAgentData` hook return; import `GoogleAIUsage` from `./components/GoogleAIUsage`; render `<GoogleAIUsage googleQuota={liveGoogleQuota} />` immediately below `<SubscriptionUsage subscription={liveSubscription} />` in the sidebar `div.space-y-6`

**Checkpoint**: Dashboard shows Google AI panel. Quota bars visible for configured state. "Not configured" message visible when env var absent. US1 independently testable.

---

## Phase 4: User Story 2 — Per-Model Quota Breakdown (Priority: P2)

**Goal**: All 4 Gemini models always appear as distinct labeled sections; idle models are visually dimmed; Preview models have a warning badge.

**Independent Test**: With no active Gemini usage, all 4 model rows appear but at reduced opacity. With Gemini 2.5 Pro in use, its section is fully opaque and others are dimmed. Any `tier: "preview"` model shows a visible badge (e.g., "Preview" label or ⚠ icon).

### Implementation for User Story 2

- [x] T010 [US2] Update `GoogleAIUsage.jsx` to always render all 4 model sections from `data.models` regardless of utilization — do not filter or hide zero-usage models; ensure the `ModelQuotaSection` component always receives the full 4-model array from the `GoogleQuotaPayload`
- [x] T011 [US2] Add idle dimming to `ModelQuotaSection` in `GoogleAIUsage.jsx`: compute `isIdle` as `rpm.utilization === 0 && tpm.utilization === 0 && rpd.utilization === 0`; when `isIdle` is true, wrap the section in `opacity-40` (or equivalent Tailwind class) and render a collapsed/compact view showing only the model name and "—" placeholder; when not idle, render the full 3-bar layout at full opacity
- [x] T012 [US2] Add Preview model badge to `ModelQuotaSection` in `GoogleAIUsage.jsx`: when `model.tier === 'preview'`, render a small `⚠` icon (use `AlertTriangle` from lucide-react, `w-3 h-3 text-pending`) and a `"Preview"` label tag (styled like the `subscriptionType` badge in `SubscriptionUsage.jsx`) next to the model display name in the section header

**Checkpoint**: All 4 model sections always visible. Idle models visually distinct from active ones. Preview models have warning indicator. US2 independently testable on top of US1.

---

## Phase 5: User Story 3 — Reset Countdown and Quota Limit Context (Priority: P3)

**Goal**: Each quota metric bar shows a countdown to when that window resets; at 100% utilization, the countdown is prominently highlighted.

**Independent Test**: Hovering over or viewing an RPM bar shows a countdown like "45s" until the next minute boundary. An RPD bar shows "8h 22m" until midnight UTC. When utilization is 100%, the countdown text turns red (error color) and reads "Unlocks: HH:MM:SS" matching the existing `SubscriptionUsage` pattern.

### Implementation for User Story 3

- [x] T013 [US3] Extract `formatCountdown()` from `src/components/SubscriptionUsage.jsx` into a shared utility `src/utils/quota.js` (or import it inline in `GoogleAIUsage.jsx` if extraction is not warranted) — the function already handles days/hours/minutes display and the reset-time formatting; reuse it in `ModelQuotaSection` for RPM and RPD bars
- [x] T014 [US3] Update `UsageBar` instances inside `ModelQuotaSection` in `GoogleAIUsage.jsx` to pass `resetsAt={metric.windowResetsAt}` for each metric (RPM, TPM, RPD); the `UsageBar` component from `SubscriptionUsage.jsx` already renders countdown and reset time from `resetsAt` — if reusing the same component, import it; if inlining, replicate the `useEffect`-based countdown timer and the conditional `Unlocks: / Resets:` display
- [x] T015 [US3] Verify the 100% utilization highlight: when `utilization >= 100`, the `UsageBar` (or equivalent bar in `ModelQuotaSection`) renders the reset countdown in `text-error` color and uses "Unlocks:" prefix — confirm this behavior matches the spec acceptance scenario (scenario 3 of US3) and the existing `SubscriptionUsage` `isLimited` logic

**Checkpoint**: Countdown timers visible for all metric bars with data. At-limit state visually distinct. US3 independently testable on top of US1 + US2.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final integration validation and documentation

- [x] T016 [P] Update `README.md`: add `GoogleAIUsage` to the component terminology table (if one exists); document `GOOGLE_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS` env vars in the configuration section
- [x] T017 Validate against `specs/001-google-ai-usage/quickstart.md`: run the server with credentials configured and verify `curl http://localhost:3001/api/google-quota | jq '.configured, .error'` outputs `true, null`; run without `GOOGLE_PROJECT_ID` and verify the panel shows "not configured" state without JavaScript errors
- [x] T018 [P] Move feature entry in `TODO.md` from active to `## Completed` section

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001) — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Foundational (T003–T006) — T005 and T006 must both be complete
- **US2 (Phase 4)**: Depends on US1 (Phase 3) — extends `GoogleAIUsage.jsx`
- **US3 (Phase 5)**: Depends on US1 (Phase 3) — extends `GoogleAIUsage.jsx`; US2 and US3 can proceed in parallel once Phase 3 is done
- **Polish (Phase 6)**: Depends on all user story phases

### User Story Dependencies

- **US1 (P1)**: Requires Foundational complete — no story dependencies
- **US2 (P2)**: Requires US1 complete (extends same component)
- **US3 (P3)**: Requires US1 complete (extends same component); can parallelize with US2

### Within Each Phase

- T003 → T004 (poller before endpoint)
- T005 and T006 can run in parallel (different files)
- T006 must be complete before T009 (hook must export `googleQuota` before App.jsx uses it)
- T007 → T008 (component shell before bar sub-component)
- T008 → T009 (component must exist before import)
- T010 → T011 → T012 (each US2 task extends the component sequentially)
- T013 → T014 → T015 (US3 countdown tasks build on each other)

### Parallel Opportunities

Within Phase 2: T005 and T006 can run in parallel (different files, no dependency between them)
Within Phase 5: T013/T014/T015 are sequential (same component); no parallelism
Phase 4 + Phase 5 can run in parallel once Phase 3 (US1) is complete:
  - Developer A: US2 tasks (T010, T011, T012)
  - Developer B: US3 tasks (T013, T014, T015)

---

## Parallel Example: Phase 2 (Foundational)

```text
# Run simultaneously:
Task T005: "Add getGoogleQuota() to src/api/telemetry.js"
Task T006: "Extend useAgentData.js with googleQuota state and WS handler"

# Then run:
Task T003: server/googleAIQuotaPoller.js (no frontend dep)
Task T004: server/index.js extensions (after T003)
```

## Parallel Example: After US1 Complete

```text
# Run simultaneously:
Task T010: "Always render all 4 model sections in GoogleAIUsage.jsx"  [US2]
Task T013: "Extract/reuse formatCountdown for reset timers"           [US3]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T006) — **CRITICAL BLOCKER**
3. Complete Phase 3: User Story 1 (T007–T009)
4. **STOP and VALIDATE**: Panel visible, bars rendered, not-configured state working
5. Ship MVP — users can see quota for whichever models the poller maps successfully

### Incremental Delivery

1. Setup + Foundational → server endpoint working (`/api/google-quota` returns data)
2. Add US1 → basic panel in sidebar → independently testable (**MVP**)
3. Add US2 → all 4 models always shown, idle dimmed, preview badge
4. Add US3 → countdown timers and at-limit highlighting
5. Polish → documentation, validation, TODO update

### Notes

- T003 is the most complex task — the Cloud Monitoring API label mapping may require iteration against a live GCP project; log discovered label values to stdout on first successful poll
- If Cloud Monitoring label names differ from expected, the static fallback (all 4 models with 0 used) ensures the panel still renders correctly
- The `formatCountdown()` extraction in T013 is a minor refactor — if it creates friction, it's acceptable to inline the function in `GoogleAIUsage.jsx` instead
