#!/bin/bash
# Claude Code Hook: Stop / SessionEnd
# Reports agent session end to telemetry server

TELEMETRY_URL="${TELEMETRY_URL:-http://localhost:3001}"

# Read input from stdin
INPUT=$(cat)

# Extract session_id from JSON without jq (simple grep/sed)
extract_json_value() {
  echo "$1" | grep -o "\"$2\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | sed 's/.*: *"\([^"]*\)".*/\1/' | head -1
}

# Try environment variable first, then input payload, then saved session ID from start hook
SESSION_ID="${CLAUDE_SESSION_ID:-$(extract_json_value "$INPUT" "session_id")}"
if [ -z "$SESSION_ID" ] && [ -f /tmp/claude-agent-session-id ]; then
  SESSION_ID=$(cat /tmp/claude-agent-session-id)
fi
if [ -z "$SESSION_ID" ]; then
  SESSION_ID="unknown"
fi
AGENT_ID="claude-${SESSION_ID:0:12}"
PROJECT_NAME=$(basename "${CLAUDE_CWD:-$(pwd)}")

# Update agent status to complete
curl -s -X POST "${TELEMETRY_URL}/api/agents/${AGENT_ID}/heartbeat" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "status": "complete",
  "currentTask": "Session completed"
}
EOF

# Log activity
curl -s -X POST "${TELEMETRY_URL}/api/activities" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "agent": "Claude: ${PROJECT_NAME}",
  "action": "Session ended",
  "detail": "Task completed",
  "type": "complete",
  "provider": "claude",
  "agentId": "${AGENT_ID}"
}
EOF

# Return empty to allow stop
echo "{}"
