# Feature Specification: Google AI Quota Usage Display

**Feature Branch**: `001-google-ai-usage`
**Created**: 2026-03-15
**Status**: Draft
**Input**: User description: "Add Google AI usage display alongside Claude subscription usage, showing RPM/TPM/RPD quota consumption per Gemini model using the Google API"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Google AI Quota Usage at a Glance (Priority: P1)

A developer running the agents dashboard wants to see how much of their Google AI (Gemini) quota they have consumed — both per minute and per day — without leaving the dashboard. They need this at the same level of visibility as their Claude subscription usage so they can assess rate-limit risk across both providers simultaneously.

**Why this priority**: Core feature request. Without this, no Google AI quota visibility exists in the dashboard. Every other story builds on this display.

**Independent Test**: Open the dashboard with a configured Google AI API key. The Google AI Quota Usage panel appears alongside the Claude Subscription Usage panel, showing at least one Gemini model with RPM and RPD utilization bars populated.

**Acceptance Scenarios**:

1. **Given** the dashboard is open and a Google AI API key is configured, **When** the page loads, **Then** a Google AI Quota Usage panel is visible alongside the Claude Subscription Usage panel showing current utilization for active Gemini models.
2. **Given** the Google AI quota panel is displayed, **When** viewing the panel, **Then** each model row shows separate progress bars for RPM (Requests Per Minute), TPM (Tokens Per Minute), and RPD (Requests Per Day) utilization as percentages.
3. **Given** quota utilization is below 50%, **When** viewing a metric bar, **Then** the bar displays in green (healthy state).
4. **Given** quota utilization is between 75% and 90%, **When** viewing a metric bar, **Then** the bar displays in yellow/amber (warning state).
5. **Given** quota utilization reaches or exceeds 90%, **When** viewing a metric bar, **Then** the bar displays in red (critical state) to alert the user.

---

### User Story 2 - Per-Model Quota Breakdown (Priority: P2)

A developer is running multiple Gemini models in parallel agents and needs to see which specific model is approaching its rate limit. They want the quota display to break down usage separately for each active Gemini model (Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, and Preview models).

**Why this priority**: Without per-model breakdown, a user cannot distinguish which model is being throttled. However, even a single aggregate view (P1) is valuable to ship first.

**Independent Test**: With multiple Gemini models in use, each model appears as a distinct collapsible or labeled section in the Google AI quota panel showing its own RPM/TPM/RPD metrics.

**Acceptance Scenarios**:

1. **Given** multiple Gemini models have been used, **When** viewing the Google AI quota panel, **Then** each model that has quota activity appears as a separate labeled section.
2. **Given** a Gemini model has zero requests, **When** viewing the quota panel, **Then** models with no usage are either hidden or shown with 0% utilization (not cluttering the view).
3. **Given** a Preview model (3.x) is in use, **When** viewing its quota row, **Then** an indicator (e.g., warning icon) marks it as a preview model with lower RPD limits (250 RPD vs 1,500 RPD for stable models).

---

### User Story 3 - Reset Countdown and Quota Limit Context (Priority: P3)

A developer whose agent has hit a rate limit wants to know exactly when the limit resets so they can plan their next action or inform their workflow automation.

**Why this priority**: Quality-of-life improvement. The core quota visibility (P1/P2) is independently valuable, but reset timers help users act on the information.

**Independent Test**: When any quota metric is above 0%, a countdown timer showing time until the per-minute or per-day window resets is visible alongside that metric.

**Acceptance Scenarios**:

1. **Given** an RPM quota metric is visible, **When** viewing the metric, **Then** a countdown timer shows how long until the next 1-minute window resets.
2. **Given** an RPD quota metric is visible, **When** viewing the metric, **Then** a countdown timer shows the time until midnight (UTC or user local time) when the daily quota resets.
3. **Given** a quota has reached 100% utilization, **When** viewing the metric, **Then** the reset countdown is prominently highlighted to indicate when service will resume.

---

### Edge Cases

- What happens when the Google AI API key is not configured or is invalid? The panel shows a clear "API key not configured" or "Authentication failed" message rather than silently hiding.
- What happens when the quota API returns no data for a model? That model is either hidden or shown with a "no data" indicator.
- What happens when the quota API call itself fails (network error, permission issue)? The panel shows a graceful error state with a retry option, similar to the existing Claude subscription error state.
- What happens when a model's quota utilization cannot be calculated (e.g., missing limit data)? Show the raw count with a note that the limit is unavailable.
- What if the Google AI quota API has its own rate limits? Requests to the quota API must be throttled/cached to avoid self-defeating rate limit behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The dashboard MUST display a Google AI Quota Usage panel that is visually consistent with the existing Claude Subscription Usage panel.
- **FR-002**: The Google AI quota panel MUST show quota utilization for RPM (Requests Per Minute), TPM (Tokens Per Minute), and RPD (Requests Per Day) for each active Gemini model.
- **FR-003**: The system MUST retrieve current quota usage data from the Google AI platform API using a configured API key or service account credentials.
- **FR-004**: The quota panel MUST support the following Gemini models: Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, and Gemini 3.x Preview models.
- **FR-005**: Utilization bars MUST use a color-coded system: green (<50%), amber (50–89%), red (≥90%) — matching the existing dashboard color conventions.
- **FR-006**: The system MUST display the known Tier 1 quota limits alongside current usage so users can see both the numerator and denominator (e.g., "42 / 150 RPM").
- **FR-007**: The dashboard MUST refresh Google AI quota data on the same interval as Claude subscription data to maintain consistency.
- **FR-008**: The system MUST gracefully degrade when Google AI credentials are not configured — showing an informative placeholder rather than breaking the dashboard layout.
- **FR-009**: Preview models (Gemini 3.x) MUST be visually distinguished from stable models with an indicator that communicates their lower RPD quota ceiling (250 RPD vs 1,500 RPD).
- **FR-010**: The system MUST cache quota responses to avoid exceeding the quota of the quota-checking API itself.
- **FR-011**: All 4 supported Gemini models MUST always be shown in the quota panel; models with zero utilization MUST be visually dimmed or collapsed to reduce visual noise while remaining accessible.

### Key Entities

- **Gemini Model Quota**: Represents quota limits and current consumption for a single Gemini model. Key attributes: model name, model tier (stable/preview), RPM limit, RPM used, TPM limit, TPM used, RPD limit, RPD used, window reset timestamps.
- **Google AI Credentials**: The authentication material (API key or service account) used to query quota data. Not stored in the UI; sourced from server-side configuration.
- **Quota Window**: A time-bounded usage bucket (per-minute or per-day) with a known reset time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can see Google AI quota utilization for all active Gemini models within 5 seconds of opening the dashboard.
- **SC-002**: The quota display updates automatically; users do not need to manually refresh to see current utilization.
- **SC-003**: When a Gemini model reaches 90% quota utilization, the visual indicator changes state without any user interaction required.
- **SC-004**: When Google AI credentials are missing or invalid, users see a clear actionable message (not a blank panel or a JavaScript error) within 3 seconds of page load.
- **SC-005**: The quota panel integrates into the existing dashboard layout without requiring horizontal scrolling or breaking the visual hierarchy of the existing Claude subscription panel.
- **SC-006**: Quota data is never stale by more than the configured refresh interval; users can trust the displayed values reflect actual recent API consumption.

## Assumptions

- The Google Cloud Monitoring API provides quota consumption data at approximately 1-minute resolution via time-series metrics. This is near-real-time, not instantaneous — the displayed usage may lag up to 1–2 minutes behind actual activity. There is no Google-provided API that returns a live "X of Y remaining in the current minute window" value.
- Quota limits (the denominator for utilization percentages) are retrieved from the Google Cloud Service Usage API, which returns configured account limits. Tier 1 defaults (as provided by the user) serve as a fallback if the API is unavailable.
- Accessing quota and monitoring data requires a GCP service account with at minimum `roles/serviceusage.serviceUsageViewer` and `roles/monitoring.viewer` permissions. A standard Gemini API key is insufficient — the server must be configured with service account credentials.
- The backend server handles all GCP credential management and quota data fetching; the frontend receives only pre-computed utilization percentages, raw counts, and reset timestamps.
- Users operating at Tier 0 (free, no billing) have different limits; the spec assumes Tier 1 as the baseline but the display renders correctly at any tier if the API returns actual limits.
- All 4 supported Gemini models are always displayed in the quota panel. Models with zero usage are visually dimmed or collapsed to reduce noise while still providing full context. Active models (non-zero utilization) are visually prominent.
