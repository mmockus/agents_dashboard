#!/bin/bash
# Gemini CLI Wrapper
# Wraps Gemini CLI calls and reports to telemetry server
#
# Usage: ./gemini-wrapper.sh <gemini-command> [args...]
# Example: ./gemini-wrapper.sh gemini chat "What is the weather?"
#
# Set GEMINI_CMD to override the Gemini command (default: gemini)

TELEMETRY_URL="${TELEMETRY_URL:-http://localhost:3001}"
GEMINI_CMD="${GEMINI_CMD:-gemini}"

# Generate unique agent ID for this session
AGENT_ID="gemini-$(date +%s)-$$"
PROJECT_NAME=$(basename "$(pwd)")
MODEL="${GEMINI_MODEL:-gemini-2.0-flash}"

# Cleanup function to mark agent as complete
cleanup() {
  curl -s -X POST "${TELEMETRY_URL}/api/agents/${AGENT_ID}/heartbeat" \
    -H "Content-Type: application/json" \
    -d '{"status": "complete", "currentTask": "Session ended"}' >/dev/null 2>&1

  curl -s -X POST "${TELEMETRY_URL}/api/activities" \
    -H "Content-Type: application/json" \
    -d "{\"agent\": \"Gemini: ${PROJECT_NAME}\", \"action\": \"Session ended\", \"detail\": \"Process completed\", \"type\": \"complete\", \"provider\": \"gemini\", \"agentId\": \"${AGENT_ID}\"}" >/dev/null 2>&1
}

trap cleanup EXIT

# Register agent at start
curl -s -X POST "${TELEMETRY_URL}/api/agents/${AGENT_ID}" \
  -H "Content-Type: application/json" \
  -d @- <<EOF >/dev/null 2>&1
{
  "name": "Gemini: ${PROJECT_NAME}",
  "provider": "gemini",
  "type": "assistant",
  "status": "active",
  "model": "${MODEL}",
  "currentTask": "Running: $*",
  "tokensUsed": 0,
  "tokensLimit": 100000,
  "cwd": "$(pwd)",
  "subAgents": []
}
EOF

# Log activity
curl -s -X POST "${TELEMETRY_URL}/api/activities" \
  -H "Content-Type: application/json" \
  -d "{\"agent\": \"Gemini: ${PROJECT_NAME}\", \"action\": \"Session started\", \"detail\": \"$*\", \"type\": \"spawn\", \"provider\": \"gemini\", \"agentId\": \"${AGENT_ID}\"}" >/dev/null 2>&1

# Run the actual Gemini command
exec "$GEMINI_CMD" "$@"
