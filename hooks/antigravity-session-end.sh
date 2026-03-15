#!/bin/bash
# Antigravity/Gemini CLI Hook: SessionEnd
# Reports agent session end to telemetry server

TELEMETRY_URL="${TELEMETRY_URL:-http://localhost:3001}"

# Read input from stdin
INPUT=$(cat)

# Retrieve saved session ID from start hook
SESSION_ID=""
if [ -f /tmp/antigravity-agent-session-id ]; then
  SESSION_ID=$(cat /tmp/antigravity-agent-session-id)
fi
if [ -z "$SESSION_ID" ]; then
  SESSION_ID="unknown"
fi
AGENT_ID="antigravity-${SESSION_ID:0:12}"
PROJECT_NAME=$(basename "$(pwd)")

# Update agent status to complete
curl -s -X POST "${TELEMETRY_URL}/api/agents/${AGENT_ID}/heartbeat" \
  -H "Content-Type: application/json" \
  -d @- <<EOF > /dev/null 2>&1
{
  "status": "complete",
  "currentTask": "Session completed"
}
EOF

# Log activity
curl -s -X POST "${TELEMETRY_URL}/api/activities" \
  -H "Content-Type: application/json" \
  -d @- <<EOF > /dev/null 2>&1
{
  "agent": "Antigravity: ${PROJECT_NAME}",
  "action": "Session ended",
  "detail": "Task completed",
  "type": "complete",
  "provider": "antigravity",
  "agentId": "${AGENT_ID}"
}
EOF

# Return empty JSON to allow exit
echo "{}"
