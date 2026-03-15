#!/bin/bash
# Claude Code Hook: Notification
# Reports when Claude is idle/waiting for input

TELEMETRY_URL="${TELEMETRY_URL:-http://localhost:3001}"

# Read input from stdin
INPUT=$(cat)

SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
if [ "$SESSION_ID" = "unknown" ]; then
  SESSION_ID=$(cat /tmp/claude-agent-session-id 2>/dev/null || echo "unknown")
fi
AGENT_ID="claude-${SESSION_ID:0:12}"

# Set agent to waiting status when idle
curl -s -X POST "${TELEMETRY_URL}/api/agents/${AGENT_ID}/heartbeat" \
  -H "Content-Type: application/json" \
  -d @- <<EOF > /dev/null 2>&1
{
  "status": "waiting",
  "currentTask": "Waiting for your response..."
}
EOF

echo "{}"
