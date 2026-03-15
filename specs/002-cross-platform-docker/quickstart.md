# Quickstart: Deploying Agents Dashboard to a Remote Linux Host

**Feature**: 002-cross-platform-docker
**Date**: 2026-03-15

---

## Prerequisites

- Docker Engine 24+ and Docker Compose v2 installed on the remote Linux host
- SSH access to the remote host
- Your Claude credentials file locally at `~/.claude/.credentials.json`

---

## Option A: Run Locally (any OS)

No configuration needed. The server auto-detects your OS and reads credentials from:
- **macOS**: macOS Keychain (Claude Code-credentials)
- **Windows**: Windows Credential Manager (Claude Code-credentials), then file fallback
- **Linux**: `~/.claude/.credentials.json`

```bash
# Start both UI and server
docker compose up

# Access the dashboard
open http://localhost:8080
```

---

## Option B: Deploy to a Remote Linux Host

### Step 1 — Export credentials from your local machine

```bash
# macOS / Linux
export CLAUDE_CREDS=$(cat ~/.claude/.credentials.json | tr -d '\n')

# Windows (PowerShell)
$env:CLAUDE_CREDS = (Get-Content ~/.claude/.credentials.json -Raw) -replace "`r`n", "" -replace "`n", ""
```

### Step 2 — Create a `.env` file on the remote host

```bash
# Transfer credentials to the remote host (never commit this file)
ssh user@remote-host "mkdir -p ~/agents-dashboard"
ssh user@remote-host "cat > ~/agents-dashboard/.env" <<EOF
CLAUDE_CREDENTIALS=$CLAUDE_CREDS
EOF
```

### Step 3 — Deploy

```bash
# Copy docker compose files to the remote host
scp compose.yaml user@remote-host:~/agents-dashboard/

# SSH in and start
ssh user@remote-host "cd ~/agents-dashboard && docker compose --env-file .env up -d"
```

### Step 4 — Access the dashboard

```
http://your-remote-host:8080
```

---

## Option C: Push Images to a Registry (CI/CD)

```bash
# 1. Build and tag images
docker build -t your-registry/agents-dashboard-ui:latest .
docker build -t your-registry/agents-dashboard-server:latest ./server

# 2. Push to registry
docker push your-registry/agents-dashboard-ui:latest
docker push your-registry/agents-dashboard-server:latest

# 3. On remote host, pull and run
ssh user@remote-host "cd ~/agents-dashboard && docker compose pull && docker compose --env-file .env up -d"
```

---

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `CLAUDE_CREDENTIALS` | Remote only | Full contents of `~/.claude/.credentials.json` as a single-line JSON string. Takes priority over all other credential sources. |
| `PORT` | No | Server port (default: 3001) |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | Path to GCP service account key for Google AI quota monitoring |
| `GOOGLE_PROJECT_ID` | No | GCP project ID for Google AI quota monitoring |

---

## Troubleshooting

**"No credentials found" on startup**
The server tried all sources and found nothing. Ensure `CLAUDE_CREDENTIALS` is set in your `.env` file (remote) or that `~/.claude/.credentials.json` exists locally.

**Token expired error**
Your Claude access token has expired. Re-authenticate with Claude Code on your local machine and re-export the credentials.

**Port already in use**
Set `PORT` in your `.env` file to a different value (e.g., `PORT=3002`) and update port mappings in `compose.yaml`.
