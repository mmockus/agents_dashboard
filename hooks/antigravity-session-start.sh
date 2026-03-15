#!/bin/bash
# Antigravity/Gemini CLI Hook: BeforeAgent
# Reports agent session start to telemetry server

TELEMETRY_URL="${TELEMETRY_URL:-http://localhost:3001}"

# Read input from stdin (Gemini provides request context as JSON)
INPUT=$(cat)

# Generate unique session ID
SESSION_ID="$$-$(date +%s)"
AGENT_ID="antigravity-${SESSION_ID:0:12}"

# Store session ID for other hooks to use
echo "$SESSION_ID" > /tmp/antigravity-agent-session-id

# Determine agent name from working directory
CWD="$(pwd)"
PROJECT_NAME=$(basename "$CWD")

# Register agent with telemetry server
curl -s -X POST "${TELEMETRY_URL}/api/agents/${AGENT_ID}" \
  -H "Content-Type: application/json" \
  -d @- <<EOF > /dev/null 2>&1
{
  "name": "Antigravity: ${PROJECT_NAME}",
  "provider": "antigravity",
  "type": "assistant",
  "status": "active",
  "model": "gemini",
  "currentTask": "Session started in ${PROJECT_NAME}",
  "cwd": "${CWD}",
  "sessionId": "${SESSION_ID}",
  "subAgents": []
}
EOF

# Log activity
curl -s -X POST "${TELEMETRY_URL}/api/activities" \
  -H "Content-Type: application/json" \
  -d @- <<EOF > /dev/null 2>&1
{
  "agent": "Antigravity: ${PROJECT_NAME}",
  "action": "Session started",
  "detail": "${CWD}",
  "type": "spawn",
  "provider": "antigravity",
  "agentId": "${AGENT_ID}"
}
EOF

# Return empty JSON to continue execution
echo "{}"
