# Feature Specification: Cross-Platform and Docker Deployment Support

**Feature Branch**: `002-cross-platform-docker`
**Created**: 2026-03-15
**Status**: Draft
**Input**: User description: "we updated all this code to pull out of a MacOS environment and had working code for Windows. can we make that dynamic? Also I want to push this into docker to run on a remote linux host. how would we achieve that?"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run the Dashboard on Any Host OS (Priority: P1)

A developer runs the agents dashboard on their local machine regardless of whether that machine is macOS, Windows, or Linux. The dashboard automatically detects the operating system and retrieves Claude credentials from the appropriate platform credential store (macOS Keychain, Windows Credential Manager, or file fallback), without requiring the user to manually configure which path to use.

**Why this priority**: Credential retrieval is the only blocking platform-specific behavior. Without it the dashboard cannot authenticate and poll Claude subscription data. Everything else degrades gracefully.

**Independent Test**: Can be fully tested by launching the server on each OS and verifying that the dashboard loads and displays subscription/session data without manual credential configuration.

**Acceptance Scenarios**:

1. **Given** the server starts on macOS, **When** it needs Claude credentials, **Then** it retrieves them from the macOS Keychain automatically
2. **Given** the server starts on Windows, **When** it needs Claude credentials, **Then** it retrieves them from the Windows Credential Manager automatically
3. **Given** the server starts on Linux (or the platform credential store is unavailable), **When** it needs Claude credentials, **Then** it falls back to reading from the `.credentials.json` file in the user's home directory
4. **Given** none of the above sources contain valid credentials, **When** the server starts, **Then** it logs a clear error message describing which sources were tried and how to provide credentials

---

### User Story 2 - Deploy the Dashboard in Docker on a Remote Linux Host (Priority: P2)

An operator packages the entire agents dashboard (UI and server) as Docker images, pushes them to a registry, and runs them on a remote Linux server. The container receives Claude credentials through a secure mechanism (mounted file or environment variable) and the dashboard is accessible over the network without requiring any OS-specific tooling on the remote host.

**Why this priority**: Docker deployment is the primary goal for remote hosting; cross-platform detection is a prerequisite but the Docker workflow delivers the actual production value.

**Independent Test**: Can be fully tested by building images locally, running `docker compose up` on a fresh Linux machine, and confirming the dashboard is reachable in a browser and displays live agent data.

**Acceptance Scenarios**:

1. **Given** valid credentials are available on the host, **When** the operator runs `docker compose up`, **Then** the dashboard UI and server start and the UI is reachable in a browser within 60 seconds
2. **Given** credentials are provided via a mounted file, **When** the container starts, **Then** the server reads credentials without error
3. **Given** credentials are provided via an environment variable, **When** the container starts, **Then** the server reads credentials without error and the mounted file approach is not required
4. **Given** the containers are running, **When** the operator pushes new images to the registry, **Then** running `docker compose pull && docker compose up -d` updates the running service with zero manual steps

---

### User Story 3 - Local Development on Windows (Priority: P3)

A developer on Windows clones the repository and starts the dashboard locally using the standard start command. The server detects the Windows platform and reads credentials from Windows Credential Manager, and any shell scripts required at runtime are either replaced with cross-platform equivalents or skipped gracefully on Windows.

**Why this priority**: Enables the full developer workflow on Windows without requiring WSL or manual workarounds, but Docker on Windows also satisfies this need, so it is lower priority.

**Independent Test**: Can be fully tested by running the server on a Windows machine with credentials stored in Credential Manager and confirming that the dashboard loads without modifying any source files.

**Acceptance Scenarios**:

1. **Given** the server starts on Windows with credentials in Credential Manager, **When** it polls for subscription data, **Then** it returns valid data
2. **Given** the server starts on Windows and Credential Manager access fails, **When** it initializes, **Then** it falls back to the `.credentials.json` file path

---

### Edge Cases

- What happens when the credential store exists but the specific key ("Claude Code-credentials") is not present?
- How does the system handle partial or malformed credentials returned by any platform store?
- What happens when the Docker host does not mount a credentials file and no environment variable is set?
- How does the system behave when the container is restarted after credentials have changed on the host?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The server MUST detect the current host operating system at startup and select the appropriate credential retrieval strategy automatically
- **FR-002**: The server MUST attempt to retrieve Claude credentials from the macOS Keychain when running on macOS
- **FR-003**: The server MUST attempt to retrieve Claude credentials from the Windows Credential Manager when running on Windows
- **FR-004**: The server MUST fall back to reading credentials from `~/.claude/.credentials.json` when running on Linux or when platform-specific credential stores are unavailable or return no result
- **FR-005**: The server MUST accept credentials via an environment variable as an override, taking precedence over all other credential sources
- **FR-006**: The system MUST provide a Docker Compose configuration that starts both the UI and server containers on a Linux host with a single command
- **FR-007**: The Docker Compose configuration MUST support providing credentials via either a bind-mounted file or an environment variable, documented in a clear setup guide
- **FR-008**: The server MUST log a human-readable message when credential retrieval fails for any source, describing which source was tried and how to resolve the issue
- **FR-009**: All runtime credential retrieval logic MUST be encapsulated in a single, testable module so that each platform-specific path can be exercised independently in tests

### Key Entities

- **Credential Source**: A platform-specific or generic mechanism for retrieving the Claude OAuth token (macOS Keychain, Windows Credential Manager, file, environment variable)
- **Credential Resolver**: The orchestration component that selects and executes the correct Credential Source based on the detected OS, with ordered fallback
- **Deployment Package**: The combination of Docker images, Compose configuration, and supporting documentation needed to run the dashboard on a remote Linux host

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer on macOS, Windows, or Linux can start the dashboard locally without modifying any source files — zero manual credential-path configuration required
- **SC-002**: An operator can deploy the dashboard to a fresh Linux host with Docker installed in under 10 minutes following the provided setup guide
- **SC-003**: Credential retrieval failures produce an actionable error message within 5 seconds of server startup, identifying which sources were attempted
- **SC-004**: The Docker Compose deployment passes a full smoke test (UI loads, live agent data is displayed) on a clean Linux environment with no pre-installed Node.js or npm
- **SC-005**: No platform-specific credential code exists outside the designated Credential Resolver module, verifiable by code review

## Assumptions

- The Windows Credential Manager target name for Claude credentials mirrors the macOS Keychain key ("Claude Code-credentials") or an equivalent mapping will be established during implementation
- The remote Linux host has Docker Engine and Docker Compose v2 installed; Docker installation itself is out of scope
- Google Cloud credentials (GOOGLE_APPLICATION_CREDENTIALS) are handled separately from Claude credentials and are already supplied via environment variable or mounted file in the existing compose configuration — this feature does not change that behavior
- The hooks scripts in `/hooks/` are Claude Code developer tooling and are not required at runtime inside Docker containers; cross-platform support for hooks is out of scope
- The existing Alpine-based Dockerfiles are already suitable for Linux deployment; this feature refines compose configuration and credential handling rather than replacing container bases
