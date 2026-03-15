# Research: Cross-Platform and Docker Deployment Support

**Feature**: 002-cross-platform-docker
**Date**: 2026-03-15
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Decision 1: Windows Credential Manager Access Strategy

**Decision**: Use a PowerShell subprocess call (no new npm dependencies) for Windows Credential Manager access, consistent with the existing macOS `security` shell command pattern.

**Rationale**:
- The existing macOS credential path uses a shell subprocess (`security find-generic-password`) — a PowerShell subprocess on Windows is architecturally identical, keeping the implementation pattern coherent
- Adding `keytar` (the primary alternative) introduces native bindings that require node-gyp compilation, complicate Alpine-based Docker builds, and conflict with Constitution Principle III ("dependency-light")
- PowerShell is available on all modern Windows systems (PowerShell 5.1+) without any installation step
- The implementation is two lines of JavaScript calling one PowerShell cmdlet

**PowerShell command for Windows Credential Manager**:
```
powershell -NoProfile -Command "(New-Object System.Net.NetworkCredential('', (Get-StoredCredential -Target 'Claude Code-credentials' -Type Generic).Password)).Password"
```
If the PSCredentialManager module is not available, fall back to:
```
powershell -NoProfile -Command "$c=[Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]::new(); ($c.Retrieve('Claude Code-credentials','')).Password"
```

**Note**: The exact Windows storage location Claude Code uses on Windows (Credential Manager vs file at `%APPDATA%\Claude`) should be verified on a Windows machine during implementation. If Claude Code on Windows stores credentials in a file rather than Credential Manager, the file fallback path already handles this.

**Alternatives considered**:
- `keytar` npm package: Rejected — native bindings, node-gyp, breaks Alpine Docker builds, violates Constitution Principle III
- `node-keytar`: Rejected — unmaintained
- File-only fallback on Windows: Acceptable as a safe default if Credential Manager location cannot be verified

---

## Decision 2: Docker Credential Injection for Remote Linux Host

**Decision**: Add `CLAUDE_CREDENTIALS` environment variable as a first-priority credential source. The existing file volume mount is preserved for local dev. A companion `compose.remote.yaml` (or `.env` file pattern) is provided for remote deployments without the credentials file present.

**Rationale**:
- Env var injection is the simplest approach with zero new infrastructure: one variable, no file management on the remote host
- Docker Secrets (Swarm mode) adds significant operational complexity that far exceeds the scope of a single-developer monitoring tool
- The env var is never written to disk on the remote host — only lives in the container process environment
- The existing `${HOME}/.claude/.credentials.json` volume mount silently fails when the file doesn't exist on the remote host, causing confusing startup behavior; the env var provides an explicit, visible alternative

**Deployment workflow for remote host**:
1. Locally: `export CLAUDE_CREDS=$(cat ~/.claude/.credentials.json | tr -d '\n')`
2. SSH to remote host; set `CLAUDE_CREDENTIALS=$CLAUDE_CREDS` in `.env` or pass inline
3. `docker compose pull && docker compose up -d`

**Alternatives considered**:
- Docker Secrets (Swarm): Rejected — requires Swarm mode; overkill for single-host dev tool
- SCP credentials file to remote: Acceptable but adds a separate pre-deployment step and leaves credentials on remote disk
- Docker Configs: Rejected — Swarm-only

---

## Decision 3: Credential Resolver Module Structure

**Decision**: Extract all credential retrieval logic from `SubscriptionPoller` into a dedicated `server/credentialResolver.js` module that implements a priority chain.

**Priority chain** (highest to lowest):
1. `CLAUDE_CREDENTIALS` env var (JSON string) — explicit override, works everywhere
2. macOS Keychain via `security` subprocess — macOS only
3. Windows Credential Manager via PowerShell subprocess — Windows only
4. File at `~/.claude/.credentials.json` — universal fallback

**Rationale**:
- FR-009 explicitly requires a single testable module
- The priority order ensures the env var always wins (Docker use case), then tries platform-native stores, then file fallback
- Each source is a separate async function that can be unit-tested independently by injecting mock `platform` and `execAsync` values

**No new npm dependencies** required for this change.

---

## Decision 4: compose.yaml Strategy

**Decision**: Update `compose.yaml` to pass `CLAUDE_CREDENTIALS` env var through to the server container, and document an optional volume mount pattern for local dev. The volume mount line is kept but the `CLAUDE_CREDENTIALS` env var takes priority in the resolver.

**One compose file** (no separate `compose.remote.yaml`) — the same file works for both local and remote deployment:
- Local: Set `${HOME}` on the host; volume mount works; `CLAUDE_CREDENTIALS` env var is empty/unset
- Remote: Pass `CLAUDE_CREDENTIALS` via `.env` file; volume mount silently produces a missing-file warning (acceptable, documented)

The `${HOME}/.claude/.credentials.json` bind mount on a remote host where that file doesn't exist will produce a Docker warning but will NOT prevent container startup. The credential resolver then falls through to the env var.
