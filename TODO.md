# TODO - Agents Dashboard

## High Priority

### Persistence
- [ ] Add SQLite or file-based storage for agents/activities (currently in-memory, lost on server restart)
- [ ] Persist subscription usage history for trending

### Agent Management
- [ ] Add manual "dismiss" button to remove completed/stale agents from UI
- [ ] Configurable auto-cleanup timeout (currently hardcoded to 1 hour)
- [ ] Agent grouping by project/workspace

## Medium Priority

### Visualization
- [ ] Sub-agent tree visualization (currently just shows count)
- [ ] Click agent card to expand details panel (full task history, timestamps)
- [ ] Activity timeline view with filtering by agent

### Notifications
- [ ] Browser notifications when agent enters "waiting" state
- [ ] Sound alerts for rate limit warnings
- [ ] Desktop notification integration

### Analytics
- [ ] Usage graphs over time (daily/weekly trends)
- [ ] Token estimation based on activity patterns
- [ ] Session duration tracking and averages

## Low Priority

### Multi-Provider
- [ ] Gemini provider integration (hooks exist, needs testing)
- [ ] OpenAI provider support
- [ ] Provider-specific styling and metrics
- [ ] Google AI quota: calibrate Cloud Monitoring label matchers against live GCP responses (quota_metric label format varies by project/billing tier)

### UI/UX
- [ ] Light/dark theme toggle
- [ ] Compact view mode for many agents
- [ ] Keyboard shortcuts (pause refresh, dismiss all, etc.)
- [ ] Export session logs to JSON/CSV

### Infrastructure
- [ ] Docker compose setup for easy deployment
- [ ] Environment-based configuration (dev/prod)
- [ ] Health check endpoint improvements
- [ ] WebSocket reconnection with exponential backoff

## Known Issues

- [ ] Session ID may be "unknown" if CLAUDE_SESSION_ID env var isn't set (fallback to file works but is less reliable)
- [ ] Hook paths are absolute - need relative path support or installer script
- [ ] Subscription poller requires valid OAuth token in ~/.claude/.credentials.json

## Completed

- [x] Google AI Quota Usage panel — shows RPM/TPM/RPD per Gemini model with idle dimming, preview badge, reset countdowns (requires GOOGLE_PROJECT_ID + GCP service account)
- [x] Reactive currentTask updates on every tool use
- [x] Subscription usage panel (5-hour and 7-day limits)
- [x] Visual states for agents (active/waiting/complete animations)
- [x] AskUserQuestion detection for waiting state
- [x] Notification hook for idle_prompt events
- [x] Auto-cleanup of completed agents after 1 hour
- [x] Reset time display for subscription limits
- [x] Component terminology documentation in README
