# Agents Dashboard

A real-time monitoring dashboard for Claude Code agent sessions. Track active agents, their status, current tasks, and subscription usage.

## Quick Start

```bash
# Start the telemetry server
cd server && npm install && npm run dev

# Start the frontend (in another terminal)
npm install && npm run dev

# Open http://localhost:5173
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Claude Code    │────▶│  Telemetry       │────▶│  Dashboard      │
│  (with hooks)   │     │  Server (:3001)  │     │  Frontend       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
     Hooks fire          REST + WebSocket         React + Tailwind
     on events           broadcasts updates       real-time UI
```

## Component Terminology

### Agent Card
The main visual element representing a single Claude Code session.

| Element | Description |
|---------|-------------|
| **Provider Strip** | Vertical colored bar on the left edge indicating the AI provider (orange for Claude, blue for Gemini) |
| **Status Strip** | Horizontal bar at the top that animates when the agent is actively working |
| **Icon Container** | Square icon in the top-left showing the agent type; pulses when active, glows magenta when waiting |
| **Agent Name** | Title showing "Claude: {project_name}" |
| **Model Badge** | Shows the model being used (e.g., "claude-opus-4-5-20251101") |
| **Status Badge** | Shows current status with colored indicator (Active, Waiting, Complete, etc.) |
| **Current Task** | Text showing what the agent is currently doing; includes blinking cursor when active |
| **Uptime** | How long the session has been running |
| **Sub-agents Count** | Number of spawned sub-agents (if any) |
| **Last Heartbeat** | Timer showing time since last server update |

### Agent Statuses

| Status | Visual Treatment | Meaning |
|--------|-----------------|---------|
| **Active** | Green, icon pulses, status strip animates, blinking cursor | Agent is working/processing |
| **Waiting** | Magenta glow, icon container pulses with ring effect, "Needs Input" label | Agent needs user response |
| **Complete** | Blue-gray, static, no animations | Session finished successfully |
| **Idle** | Gray, static | Session is paused/inactive |
| **Error** | Red glow | Something went wrong |
| **Pending** | Yellow/amber | Queued or initializing |

### Subscription Usage Panel
Shows your Claude subscription utilization.

| Element | Description |
|---------|-------------|
| **Usage Bar** | Progress bar showing percentage of limit used |
| **5-Hour Window** | Rolling 5-hour usage limit |
| **7-Day Window** | Rolling 7-day usage limit |
| **Reset Countdown** | Time remaining until the limit resets |
| **Reset Time** | Exact date/time when the limit will reset |
| **Subscription Type** | Your subscription tier (e.g., "pro", "max") |

### Google AI Quota Panel
Shows Gemini API quota consumption per model (requires GCP service account — see [Google AI Quota Setup](#google-ai-quota-setup)).

| Element | Description |
|---------|-------------|
| **Model Section** | One section per Gemini model (Pro, Flash, Flash-Lite, Preview) |
| **RPM Bar** | Requests-per-minute utilization (resets each 60s window) |
| **TPM Bar** | Tokens-per-minute utilization |
| **RPD Bar** | Requests-per-day utilization (resets at midnight UTC) |
| **Used/Limit** | Raw count alongside the percentage (e.g., "42/150") |
| **Reset Countdown** | Time until the current window resets |
| **Preview Badge** | Warning indicator on Gemini 3.x preview models (lower RPD limit: 250 vs 1,500) |
| **Idle Dimming** | Models with zero utilization are displayed at reduced opacity |

### Activity Feed
Scrolling list of recent agent activities.

| Element | Description |
|---------|-------------|
| **Activity Item** | Single logged action (edit, command, spawn, etc.) |
| **Agent Name** | Which agent performed the action |
| **Action** | What happened (File modified, Command executed, etc.) |
| **Detail** | Specific information (filename, command text, etc.) |
| **Timestamp** | When the action occurred |

### Header Elements

| Element | Description |
|---------|-------------|
| **Status Bar** | Shows total/active/pending/error agent counts |
| **Provider Filter** | Filter agents by provider (All, Claude, Gemini) |
| **Refresh Control** | Manual refresh and auto-refresh interval settings |
| **Connection Indicator** | Shows WebSocket connection status |

### Footer Elements

| Element | Description |
|---------|-------------|
| **Connection Status** | "Connected" or "Offline" with icon |
| **Sub-agents Total** | Total sub-agents across all sessions |
| **Usage Summary** | Compact 5-hour usage percentage |
| **Provider Legend** | Color key for Claude and Gemini |

## Hooks

The dashboard receives data via Claude Code hooks in the `hooks/` directory:

| Hook | Event | Purpose |
|------|-------|---------|
| `telemetry-session-start.sh` | SessionStart | Register new agent session |
| `telemetry-tool-use.sh` | PostToolUse | Update current task, log activities |
| `telemetry-notification.sh` | Notification (idle_prompt) | Set waiting status when Claude needs input |
| `telemetry-session-end.sh` | Stop | Mark session as complete |

### Installing Hooks

Copy the hooks configuration to your Claude Code settings:

```bash
cp hooks/hooks.json ~/.claude/hooks.json
```

Or merge with existing hooks if you have other hooks configured.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents` | GET | List all agents |
| `/api/agents/:id` | GET | Get single agent |
| `/api/agents/:id` | POST | Register/update agent |
| `/api/agents/:id/heartbeat` | POST | Update agent status/task |
| `/api/agents/:id` | DELETE | End agent session |
| `/api/activities` | GET | List recent activities |
| `/api/activities` | POST | Log new activity |
| `/api/subscription` | GET | Get Claude subscription usage |
| `/api/google-quota` | GET | Get Google AI (Gemini) quota usage |
| `/api/rate-limit` | GET/POST/DELETE | Manage rate limit alerts |
| `/api/health` | GET | Server health check |

## WebSocket Events

The server broadcasts these events to connected dashboards:

| Event | Description |
|-------|-------------|
| `init` | Initial state on connection |
| `agent:update` | Agent registered or updated |
| `agent:heartbeat` | Agent status/task changed |
| `agent:ended` | Agent session completed |
| `activity:new` | New activity logged |
| `subscription:update` | Claude subscription usage changed |
| `google-quota:update` | Google AI quota data updated |
| `rate-limit` | Rate limit reported |
| `rate-limit-cleared` | Rate limit cleared |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TELEMETRY_URL` | `http://localhost:3001` | Server URL for hooks |
| `VITE_TELEMETRY_URL` | `http://localhost:3001` | Server URL for frontend |
| `PORT` | `3001` | Server port |
| `GOOGLE_PROJECT_ID` | — | GCP project ID for Google AI quota monitoring (optional) |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | Path to GCP service account JSON key (optional, uses ADC if unset) |

## Agent Lifecycle

```
SessionStart hook fires
        │
        ▼
   ┌─────────┐
   │  Active │◄────────────────┐
   └────┬────┘                 │
        │ PostToolUse          │ User responds
        ▼                      │
   ┌─────────┐    idle_prompt  │
   │ Working │───────────────►┌┴────────┐
   └────┬────┘                │ Waiting │
        │                     └─────────┘
        │ Stop hook fires
        ▼
   ┌──────────┐
   │ Complete │──── (removed after 15 minutes)
   └──────────┘
```

- **Active/Working**: Agent is processing, card animates
- **Waiting**: Agent needs user input, card glows magenta
- **Complete**: Session ended, card is static, auto-removed after 1 hour
- **Idle**: No recent activity (inactive sessions persist until server restart)

## Google AI Quota Setup

The Google AI Quota panel is optional. To enable it, the server needs access to the Google Cloud Monitoring and Service Usage APIs.

**Required GCP IAM roles** on the service account:
- `roles/monitoring.viewer`
- `roles/serviceusage.serviceUsageViewer`

**Option A: Service account key (Docker/production)**
```bash
# In server/ create a .env file or set environment variables:
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
GOOGLE_PROJECT_ID=your-gcp-project-id
```

**Option B: Application Default Credentials (local dev)**
```bash
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/monitoring.read,https://www.googleapis.com/auth/cloud-platform.read-only
export GOOGLE_PROJECT_ID=your-gcp-project-id
```

Without `GOOGLE_PROJECT_ID`, the panel shows a "not configured" placeholder and makes no GCP API calls.

**Note**: Quota data has a ~1–2 minute lag (Google Cloud Monitoring ingestion delay). The panel polls every 60 seconds.

## Subscription Usage

The dashboard displays your Claude subscription utilization by reading OAuth credentials from `~/.claude/.credentials.json` and polling the Anthropic usage API.

**Requirements:**
- Valid Claude Code OAuth session (run `claude` CLI and authenticate)
- The credentials file contains `claudeAiOauth.accessToken`

**Data shown:**
- 5-hour rolling window utilization
- 7-day rolling window utilization
- Reset countdown and exact reset times

If credentials are missing or expired, the panel shows an error state but the rest of the dashboard continues working.

## Troubleshooting

### Agent not appearing
1. Verify hooks are installed: `cat ~/.claude/hooks.json`
2. Check telemetry server is running: `curl http://localhost:3001/api/health`
3. The `SessionStart` hook only fires for new sessions - existing sessions need a tool use to register

### Stale agents
- Completed agents are auto-removed after 1 hour
- To clear all agents: `curl -X DELETE http://localhost:3001/api/agents`
- Restart the server to reset all data

### Subscription panel not loading
- Ensure you're authenticated with Claude Code CLI
- Check `~/.claude/.credentials.json` exists and has valid `claudeAiOauth.accessToken`
- Server polls every 5 minutes; first data appears after initial fetch

### Hook paths
The hooks use absolute paths. If you move the project, update the paths in:
- `~/.claude/hooks.json`
- Or re-copy from `hooks/hooks.json`

## Future Work

See [TODO.md](TODO.md) for planned features and known issues.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, WebSocket (ws)
- **Data**: In-memory (ephemeral)
