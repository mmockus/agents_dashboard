# Implementation Plan: Cross-Platform and Docker Deployment Support

**Branch**: `002-cross-platform-docker` | **Date**: 2026-03-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-cross-platform-docker/spec.md`

## Summary

The dashboard's credential retrieval is currently macOS-only (uses the `security` shell command). This plan extracts credential resolution into a standalone, testable module with OS-aware logic (macOS Keychain → Windows Credential Manager → file fallback) and adds an env-var override that unblocks Docker deployment to a remote Linux host. No new npm dependencies are introduced.

## Technical Context

**Language/Version**: Node.js 22 (server), React 18 (frontend)
**Primary Dependencies**: Express 4, `ws` 8, `cors` 2 (server); React + Vite + Tailwind + Framer Motion (frontend)
**Storage**: In-memory (server); no database
**Testing**: Node.js built-in test runner (`node:test`)
**Target Platform**: macOS, Windows, Linux (local dev); Alpine Linux (Docker container)
**Project Type**: Web application (full-stack: Express server + React SPA)
**Performance Goals**: No change — credential resolution runs once every 5-minute poll cycle
**Constraints**: No new npm dependencies (Constitution Principle III); server must remain dependency-light
**Scale/Scope**: Single-developer monitoring tool; 1 server instance

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked post-design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Real-Time Observability | ✅ Pass | Credential module is a prerequisite for polling; no WebSocket contract changes |
| II. Hooks-Driven Telemetry | ✅ Pass | No change to hook events or telemetry pipeline |
| III. Simplicity First (YAGNI) | ✅ Pass | No new npm dependencies; PowerShell subprocess mirrors existing macOS shell command pattern |
| IV. Unambiguous UI States | ✅ Pass | No UI state changes |
| V. Provider Agnosticism | ✅ Pass | Credential resolution is infrastructure; no provider-specific logic in core models |

**Post-design re-check**: Constitution still passes after Phase 1 design. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/002-cross-platform-docker/
├── plan.md              ← This file
├── research.md          ← Phase 0: decisions and rationale
├── data-model.md        ← Phase 1: CredentialSource, OAuthCredentials, module boundary
├── quickstart.md        ← Phase 1: deployment guide for remote Linux host
├── checklists/
│   └── requirements.md  ← Spec validation checklist
└── tasks.md             ← Phase 2 output (/speckit.tasks command)
```

### Source Code Changes

```text
server/
├── credentialResolver.js   ← NEW: credential resolution module
├── subscriptionPoller.js   ← MODIFIED: delegate to credentialResolver
└── .env.example            ← MODIFIED: add CLAUDE_CREDENTIALS documentation

compose.yaml                ← MODIFIED: add CLAUDE_CREDENTIALS env var pass-through
```

No frontend changes. No new test files beyond the credential resolver unit tests.

## Phase 0: Research

**Status**: Complete — see [research.md](research.md)

All NEEDS CLARIFICATION items resolved:

1. **Windows credential access**: Use PowerShell subprocess (no new dependencies). Exact Windows storage location to be verified during implementation; file fallback is an acceptable safe default if Credential Manager is not used by Claude Code on Windows.
2. **Docker credential injection**: `CLAUDE_CREDENTIALS` env var (JSON string) as highest-priority source. Volume mount preserved for local dev. Single `compose.yaml` serves both local and remote.
3. **Module structure**: Single `credentialResolver.js` with four named source functions in priority order.
4. **compose.yaml**: Add `CLAUDE_CREDENTIALS` passthrough; keep existing volume mount for backward compatibility.

## Phase 1: Design

### Module: `server/credentialResolver.js`

**Responsibility**: Resolve Claude OAuth credentials from the correct source for the current environment. Return a `CredentialResolutionResult` (see [data-model.md](data-model.md)).

**Priority chain**:

```
1. CLAUDE_CREDENTIALS env var    (all platforms, Docker/remote use case)
2. macOS Keychain via `security` (darwin only)
3. Windows Credential Manager    (win32 only, via PowerShell subprocess)
4. ~/.claude/.credentials.json  (universal file fallback)
```

**Token validation** (same logic currently in `subscriptionPoller.js`, moved here):
- Must have non-empty `accessToken`
- If `expiresAt` is set, must be greater than `Date.now()`
- Return `null` with a descriptive `error` message if validation fails

**Error message format** when all sources fail:
```
Credentials not found. Tried: [env var, macOS Keychain, file].
To fix: set CLAUDE_CREDENTIALS env var or ensure ~/.claude/.credentials.json exists.
```

---

### Changes to `server/subscriptionPoller.js`

Remove the inline `readCredentials()` method. Replace with:

```javascript
import { resolveCredentials } from './credentialResolver.js'

// In readCredentials():
async readCredentials() {
  const result = await resolveCredentials()
  if (!result.credentials) {
    this.lastError = result.error
  }
  return result.credentials
}
```

All credential logic lives in `credentialResolver.js`.

---

### Changes to `compose.yaml`

Add `CLAUDE_CREDENTIALS` to the server's environment block:

```yaml
services:
  server:
    environment:
      - PORT=3001
      - HOME=/home/node
      - CLAUDE_CREDENTIALS=${CLAUDE_CREDENTIALS:-}   # optional; takes priority over file mount
```

The `${CLAUDE_CREDENTIALS:-}` syntax defaults to an empty string when unset, so local dev is unaffected. The credential resolver checks for a non-empty value before parsing.

---

### Changes to `server/.env.example`

Add a documented section for `CLAUDE_CREDENTIALS`:

```bash
# ── Claude Credentials (Docker / Remote Deployment) ──────────────────────────
# Pass the full ~/.claude/.credentials.json content as a single-line JSON string.
# This takes priority over macOS Keychain, Windows Credential Manager, and the file.
# Required when running in Docker on a remote host (no credentials file present).
#
# Generate with:
#   macOS/Linux: export CLAUDE_CREDENTIALS=$(cat ~/.claude/.credentials.json | tr -d '\n')
#   Windows PS:  $env:CLAUDE_CREDENTIALS = (Get-Content ~/.claude/.credentials.json -Raw)
#
# CLAUDE_CREDENTIALS={"claudeAiOauth":{"accessToken":"...","expiresAt":...}}
```

---

### Deployment Guide

See [quickstart.md](quickstart.md) for the full step-by-step deployment guide for remote Linux hosts.

---

### Agent Context Update

Run after design is confirmed:

```bash
.specify/scripts/bash/update-agent-context.sh claude
```

## Complexity Tracking

*No constitution violations. No entries required.*
