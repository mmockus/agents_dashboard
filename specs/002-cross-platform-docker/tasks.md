---

description: "Task list for Cross-Platform and Docker Deployment Support"
---

# Tasks: Cross-Platform and Docker Deployment Support

**Input**: Design documents from `/specs/002-cross-platform-docker/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Not explicitly requested — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Create the new module file and confirm project structure

- [X] T001 Create empty `server/credentialResolver.js` with ESM export stubs: `tryEnvVar`, `tryMacKeychain`, `tryWindowsCredMan`, `tryCredentialsFile`, and `resolveCredentials`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared credential validation logic used by all source functions

**⚠️ CRITICAL**: All user story source implementations depend on this phase

- [X] T002 Implement `validateOAuthToken(oauth)` helper in `server/credentialResolver.js` — checks `accessToken` is non-empty and `expiresAt > Date.now()`, throws descriptive error on failure
- [X] T003 Implement the `resolveCredentials()` orchestrator in `server/credentialResolver.js` — calls each source in priority order (env var → macOS Keychain → Windows CredMan → file), collects `triedSources`, returns `CredentialResolutionResult` with descriptive error when all sources fail

**Checkpoint**: Foundation ready — each credential source can now be implemented independently

---

## Phase 3: User Story 1 — Run the Dashboard on Any Host OS (Priority: P1) 🎯 MVP

**Goal**: OS-aware credential resolution with automatic platform detection and clear error messages on failure

**Independent Test**: Start the server on macOS — credentials load from Keychain without any manual config. Start on Linux — credentials load from `~/.claude/.credentials.json`. Setting `CLAUDE_CREDENTIALS` env var overrides both.

### Implementation for User Story 1

- [X] T004 [P] [US1] Implement `tryEnvVar()` in `server/credentialResolver.js` — parse `process.env.CLAUDE_CREDENTIALS` JSON, call `validateOAuthToken`, return `OAuthCredentials` or null
- [X] T005 [P] [US1] Implement `tryMacKeychain()` in `server/credentialResolver.js` — move existing `security find-generic-password` shell command from `server/subscriptionPoller.js`, guard with `process.platform === 'darwin'`, call `validateOAuthToken`
- [X] T006 [P] [US1] Implement `tryCredentialsFile()` in `server/credentialResolver.js` — move existing `readFile(CREDENTIALS_PATH)` logic from `server/subscriptionPoller.js`, keep `homedir()`-based path, call `validateOAuthToken`
- [X] T007 [US1] Update `server/subscriptionPoller.js` — remove `readCredentials()` method body; replace with `import { resolveCredentials } from './credentialResolver.js'` and a thin wrapper that reads `result.credentials` and assigns `result.error` to `this.lastError` (depends on T004, T005, T006)

**Checkpoint**: US1 complete — server starts and resolves credentials on macOS and Linux without any manual configuration

---

## Phase 4: User Story 2 — Deploy to Remote Linux Host in Docker (Priority: P2)

**Goal**: Single `docker compose up` deploys the full dashboard on a Linux host using `CLAUDE_CREDENTIALS` env var for credential injection

**Independent Test**: On a clean Linux machine with Docker, set `CLAUDE_CREDENTIALS` to the JSON content of a valid credentials file, run `docker compose up`, and confirm the UI loads at `http://localhost:8080` and displays live agent data.

### Implementation for User Story 2

- [X] T008 [P] [US2] Update `compose.yaml` — add `CLAUDE_CREDENTIALS=${CLAUDE_CREDENTIALS:-}` to the `server` service `environment` block
- [X] T009 [P] [US2] Update `server/.env.example` — add a `Claude Credentials (Docker / Remote Deployment)` section documenting `CLAUDE_CREDENTIALS`, with the `cat ~/.claude/.credentials.json | tr -d '\n'` generation command for macOS/Linux and the PowerShell equivalent for Windows
- [ ] T010 [US2] Smoke-test Docker deployment locally — run `docker compose build && docker compose up` with `CLAUDE_CREDENTIALS` set to local credentials JSON; confirm server container starts, credential resolver logs "resolved via env var", and UI at `http://localhost:8080` loads (depends on T007, T008)

**Checkpoint**: US2 complete — the dashboard can be deployed to a remote Linux host by setting one env var

---

## Phase 5: User Story 3 — Local Development on Windows (Priority: P3)

**Goal**: Windows developers can start the server natively and credentials are retrieved from Windows Credential Manager (or file fallback) without any manual configuration

**Independent Test**: On a Windows machine, run the server with `node index.js`; confirm credentials are retrieved from Windows Credential Manager if present, or from `~/.claude/.credentials.json` otherwise.

### Implementation for User Story 3

- [X] T011 [US3] Implement `tryWindowsCredMan()` in `server/credentialResolver.js` — guard with `process.platform === 'win32'`; use PowerShell subprocess `powershell -NoProfile -Command` to read the "Claude Code-credentials" target from Windows Credential Manager; parse JSON result, call `validateOAuthToken`, return credentials or null on failure (depends on T002)
- [X] T012 [US3] Verify Windows file fallback path in `tryCredentialsFile()` — confirm `homedir()` returns `C:\Users\<name>` on Windows and that the `.claude/.credentials.json` path resolves correctly; add a Windows-specific path note in a code comment if needed (depends on T006)

**Checkpoint**: US3 complete — all three platforms resolve credentials automatically

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and cleanup across all stories

- [X] T013 [P] Update `README.md` — add a "Credentials & Deployment" section covering: how each OS resolves credentials, the `CLAUDE_CREDENTIALS` env var, and a link to `specs/002-cross-platform-docker/quickstart.md` for remote deployment steps
- [X] T014 [P] Remove dead credential-related code from `server/subscriptionPoller.js` — delete the `CREDENTIALS_PATH` constant, `execAsync` import, and any imports made redundant by the delegation to `credentialResolver.js`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001) — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 (T002, T003) — T004, T005, T006 can run in parallel; T007 depends on T004–T006
- **US2 (Phase 4)**: T008 and T009 are independent; T010 depends on T007 (US1 complete) + T008
- **US3 (Phase 5)**: T011 depends on T002; T012 depends on T006
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2 — no dependency on other stories
- **US2 (P2)**: T008/T009 can start after Phase 1; T010 requires US1 complete (T007)
- **US3 (P3)**: Can start after Phase 2; independent of US2

### Parallel Opportunities

- T004, T005, T006: All three credential source functions are independent within `credentialResolver.js` — write in separate passes or in one sitting
- T008, T009: `compose.yaml` and `.env.example` changes are independent files — can be done simultaneously
- T013, T014: Both are cleanup/docs tasks in different files — fully parallel

---

## Parallel Example: User Story 1

```bash
# These three source functions can be written in any order (all in credentialResolver.js):
Task T004: "Implement tryEnvVar() in server/credentialResolver.js"
Task T005: "Implement tryMacKeychain() in server/credentialResolver.js"
Task T006: "Implement tryCredentialsFile() in server/credentialResolver.js"

# Then T007 wires them into subscriptionPoller.js
Task T007: "Update server/subscriptionPoller.js to delegate to resolveCredentials()"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002, T003) — **critical blocker**
3. Complete Phase 3: US1 (T004 → T005 → T006 → T007)
4. **STOP and VALIDATE**: Launch server on macOS, confirm credential resolution; set `CLAUDE_CREDENTIALS` and confirm override works
5. Deploy locally with `docker compose up` if ready

### Incremental Delivery

1. Setup + Foundational → skeleton module ready
2. US1 (T004–T007) → OS-aware credentials on macOS/Linux (**MVP**)
3. US2 (T008–T010) → Docker remote deployment works
4. US3 (T011–T012) → Full Windows support
5. Polish (T013–T014) → Docs finalized

---

## Notes

- [P] tasks can run in parallel (no conflicting file edits for overlapping tasks)
- Each US phase is independently testable before moving to the next
- T010 (Docker smoke test) is the only task requiring a running environment — all others are pure code edits
- Windows CredMan (T011) should be manually verified on a real Windows machine; if Claude Code on Windows stores credentials in a file rather than Credential Manager, T011 can be deferred and `tryCredentialsFile()` already covers the fallback
