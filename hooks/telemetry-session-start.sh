#!/bin/bash
# Claude Code Hook: SessionStart
# Reports agent session start to telemetry server

TELEMETRY_URL="${TELEMETRY_URL:-http://localhost:3001}"

# Read input from stdin (Claude provides session context)
INPUT=$(cat)

# Extract session_id from JSON without jq (simple grep/sed)
extract_json_value() {
  echo "$1" | grep -o "\"$2\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | sed 's/.*: *"\([^"]*\)".*/\1/' | head -1
}

# Extract session info from environment/input
SESSION_ID="${CLAUDE_SESSION_ID:-$(extract_json_value "$INPUT" "session_id")}"
# Fallback: generate unique ID if still empty
if [ -z "$SESSION_ID" ]; then
  SESSION_ID="$$-$(date +%s)"
fi
CWD="${CLAUDE_CWD:-$(pwd)}"
MODEL="${CLAUDE_MODEL:-unknown}"

# Generate agent ID from session
AGENT_ID="claude-${SESSION_ID:0:12}"

# Store session ID for other hooks to use
echo "$SESSION_ID" > /tmp/claude-agent-session-id

# Determine agent name from working directory
PROJECT_NAME=$(basename "$CWD")

# Register agent with telemetry server
curl -s -X POST "${TELEMETRY_URL}/api/agents/${AGENT_ID}" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "name": "Claude: ${PROJECT_NAME}",
  "provider": "claude",
  "type": "assistant",
  "status": "active",
  "model": "${MODEL}",
  "currentTask": "Session started in ${PROJECT_NAME}",
  "cwd": "${CWD}",
  "sessionId": "${SESSION_ID}",
  "subAgents": []
}
EOF

# Log activity
curl -s -X POST "${TELEMETRY_URL}/api/activities" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "agent": "Claude: ${PROJECT_NAME}",
  "action": "Session started",
  "detail": "${CWD}",
  "type": "spawn",
  "provider": "claude",
  "agentId": "${AGENT_ID}"
}
EOF

# Return empty to allow session to continue
echo "{}"
