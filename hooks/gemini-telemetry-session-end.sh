#!/bin/bash
# Gemini Code Hook: Stop
# Marks the agent session as complete

TELEMETRY_URL="${TELEMETRY_URL:-http://localhost:3001}"

# Read input from stdin (if provided)
INPUT=$(cat)

# Extract session_id from JSON without jq (simple grep/sed)
extract_json_value() {
  echo "$1" | grep -o "\"$2\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | sed 's/.*: *"\([^"]*\)".*/\1/' | head -1
}

# Get session ID from input payload or temp file
SESSION_ID="$(extract_json_value "$INPUT" "session_id")"
if [ -z "$SESSION_ID" ]; then
  SESSION_ID=$(cat /tmp/gemini-agent-session-id 2>/dev/null || echo "unknown")
fi
if [ "$SESSION_ID" = "unknown" ]; then
  exit 0 # No session to end
fi

AGENT_ID="gemini-${SESSION_ID:0:12}"

# Send final heartbeat to mark as complete
curl -s -X POST "${TELEMETRY_URL}/api/agents/${AGENT_ID}/heartbeat" \
  -H "Content-Type: application/json" \
  -d '{
  "status": "complete",
  "currentTask": "Session ended."
}' > /dev/null 2>&1

# Clean up session file
rm -f /tmp/gemini-agent-session-id
