<!--
SYNC IMPACT REPORT
==================
Version change: [TEMPLATE] → 1.0.0
Modified principles: N/A (initial ratification from blank template)
Added sections:
  - Core Principles (I–V)
  - Technology Stack & Constraints
  - Development Workflow
  - Governance
Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check section is generic; aligns with principles as-is
  ✅ .specify/templates/spec-template.md — No constitution-specific mandatory sections added; aligns as-is
  ✅ .specify/templates/tasks-template.md — Task categories (observability, simplicity, provider-agnostic) align; no changes required
  ✅ .specify/templates/constitution-template.md — Source template; not modified
Deferred TODOs: None
-->

# Agents Dashboard Constitution

## Core Principles

### I. Real-Time Observability (NON-NEGOTIABLE)

The dashboard's primary value is live visibility into agent activity. All agent state changes
MUST be propagated to connected clients via WebSocket within one event cycle. Polling-based
fallbacks are permitted only for data sources that do not support push (e.g., the Anthropic
subscription API), and MUST include a clear TTL. Stale data MUST be visually distinguished
from live data.

**Rationale**: A monitoring dashboard that shows outdated state is worse than no dashboard
at all — it breeds false confidence. Real-time propagation is the core contract with users.

### II. Hooks-Driven Telemetry

All agent lifecycle data MUST originate from Claude Code hook events
(`SessionStart`, `PostToolUse`, `Notification`, `Stop`). The server MUST NOT manufacture
agent state from inference or polling the Claude process. New event sources (e.g., Gemini
hooks) MUST follow the same hook contract: fire on event → POST to telemetry server →
broadcast via WebSocket.

**Rationale**: Hook events are the authoritative source of truth for agent state. Bypassing
them creates divergence between what the dashboard shows and what the agent is actually doing.

### III. Simplicity First (YAGNI)

The server MUST default to in-memory storage. Persistence layers, caching tiers, and
external databases MUST NOT be introduced without a documented, user-facing requirement
that cannot be met by the current approach. Every abstraction added requires an explicit
justification entry in the feature's Complexity Tracking table (plan.md).

**Rationale**: The current architecture is intentionally lightweight. Premature complexity
increases maintenance burden and deployment friction without proportional user value.

### IV. Unambiguous UI States

Every agent card MUST render in exactly one of the defined statuses: `Active`, `Waiting`,
`Complete`, `Idle`, `Error`, or `Pending`. Visual treatments (animations, colors, glows)
MUST be unique per status — no two statuses may share the same visual identity. New UI
components MUST define their complete visual state matrix before implementation.

**Rationale**: The dashboard is read at a glance. Ambiguous status visuals defeat the
purpose and erode user trust in the tool.

### V. Provider Agnosticism

The telemetry server API and frontend rendering pipeline MUST remain provider-neutral.
Provider-specific logic (colors, icons, hook formats) MUST be isolated to configuration
or small adapter modules. Adding a new AI provider MUST NOT require changes to core
data models, WebSocket event schemas, or the agent lifecycle state machine.

**Rationale**: The architecture already supports Claude and Gemini. Locking core logic
to a single provider would require a costly rewrite to support future integrations.

## Technology Stack & Constraints

- **Frontend**: React + Vite + Tailwind CSS + Framer Motion — no other UI framework additions
  without explicit justification.
- **Backend**: Node.js + Express + `ws` WebSocket library — MUST remain dependency-light.
- **Data**: In-memory store (ephemeral by design); persistence is opt-in, not default.
- **Hooks**: Bash scripts in `hooks/`; MUST be portable and require no dependencies beyond
  standard Unix tools and `curl`.
- **Ports**: Server defaults to `:3001`, frontend dev server to `:5173`; these MUST remain
  configurable via environment variables (`PORT`, `VITE_TELEMETRY_URL`, `TELEMETRY_URL`).
- **Security**: The dashboard is a local developer tool. Authentication is out of scope unless
  a networked/shared deployment requirement is documented.

## Development Workflow

- Features MUST be specced before implementation; use `/speckit.specify` → `/speckit.plan`
  → `/speckit.tasks` workflow.
- Each feature MUST map to at least one user story with acceptance scenarios in `spec.md`.
- UI changes MUST update the component terminology table in `README.md` if new named elements
  are introduced.
- Hook changes MUST be validated end-to-end (fire hook → verify server state → verify
  dashboard update) before merging.
- Completed work MUST be reflected in `TODO.md` (move item to `## Completed` section).

## Governance

This constitution supersedes all other practices, conventions, or ad-hoc decisions
documented elsewhere. When a conflict arises between a feature request and a principle
in this document, the principle wins unless an amendment is ratified.

**Amendment procedure**:
1. Open a PR with the proposed change to this file.
2. Increment `CONSTITUTION_VERSION` per semantic versioning rules (see below).
3. Update `LAST_AMENDED_DATE` to the amendment date.
4. Document the change in the Sync Impact Report comment at the top of this file.
5. Propagate impacts to affected templates and docs before merging.

**Versioning policy**:
- MAJOR: Principle removed, renamed, or fundamentally redefined (backward-incompatible governance change).
- MINOR: New principle or section added; existing principle materially expanded.
- PATCH: Wording clarification, typo fix, formatting — no semantic change.

**Compliance**: All PRs touching `server/`, `src/`, or `hooks/` MUST be reviewed against
the five Core Principles. Violations require a documented justification in the Complexity
Tracking table of the relevant `plan.md`.

**Version**: 1.0.0 | **Ratified**: 2026-03-15 | **Last Amended**: 2026-03-15
