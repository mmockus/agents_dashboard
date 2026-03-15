#!/bin/bash
# Claude Code Hook: PostToolUse
# Reports tool usage to telemetry server and updates agent's currentTask

TELEMETRY_URL="${TELEMETRY_URL:-http://localhost:3001}"

# Read input from stdin
INPUT=$(cat)

# Extract JSON values without jq
extract_json_value() {
  echo "$1" | grep -o "\"$2\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | sed 's/.*: *"\([^"]*\)".*/\1/' | head -1
}

# Extract tool info
TOOL_NAME=$(extract_json_value "$INPUT" "tool_name")
TOOL_NAME="${TOOL_NAME:-unknown}"
SESSION_ID="${CLAUDE_SESSION_ID:-$(extract_json_value "$INPUT" "session_id")}"
if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "unknown" ]; then
  # Try to get from a stored session file
  SESSION_ID=$(cat /tmp/claude-agent-session-id 2>/dev/null || echo "unknown")
fi
AGENT_ID="claude-${SESSION_ID:0:12}"

# Extract file_path, command, description from tool_input section
FILE_PATH=$(extract_json_value "$INPUT" "file_path")
COMMAND=$(extract_json_value "$INPUT" "command")
DESCRIPTION=$(extract_json_value "$INPUT" "description")

# Sanitize extracted values for JSON embedding
COMMAND=$(echo "$COMMAND" | tr '"\\' "'/" | head -c 50)
FILE_PATH=$(echo "$FILE_PATH" | tr '"\\' "'/")

# Extract pattern for Grep/Glob
PATTERN=$(extract_json_value "$INPUT" "pattern")
PATTERN=$(echo "$PATTERN" | tr '"\\' "'/" | head -c 30)

# Determine activity type and currentTask based on tool
# Prefer the description field when available (contains Claude's task context)
case "$TOOL_NAME" in
  "Edit"|"Write")
    ACTION="File modified"
    TYPE="edit"
    DETAIL=$(basename "${FILE_PATH:-unknown file}")
    CURRENT_TASK="Editing ${DETAIL}"
    ;;
  "Bash")
    ACTION="Command executed"
    TYPE="success"
    # Use description if available (more meaningful), otherwise show command
    if [ -n "$DESCRIPTION" ]; then
      DETAIL="${DESCRIPTION:0:60}"
      CURRENT_TASK="${DESCRIPTION:0:60}"
    else
      DETAIL="${COMMAND:0:50}"
      CURRENT_TASK="Running: ${DETAIL}"
    fi
    ;;
  "Read")
    ACTION="File accessed"
    TYPE="success"
    DETAIL=$(basename "${FILE_PATH:-codebase}")
    CURRENT_TASK="Reading ${DETAIL}"
    ;;
  "Glob")
    ACTION="File search"
    TYPE="success"
    DETAIL="${PATTERN:-files}"
    CURRENT_TASK="Finding ${PATTERN:-files}"
    ;;
  "Grep")
    ACTION="Code search"
    TYPE="success"
    DETAIL="${PATTERN:-pattern}"
    CURRENT_TASK="Searching: ${PATTERN:-code}"
    ;;
  "Task")
    ACTION="Sub-agent spawned"
    TYPE="spawn"
    DETAIL="${DESCRIPTION:-Task}"
    CURRENT_TASK="Sub-agent: ${DETAIL}"
    ;;
  "TodoWrite")
    ACTION="Updated tasks"
    TYPE="success"
    DETAIL="Task list"
    CURRENT_TASK="Updating task list"
    ;;
  "WebFetch"|"WebSearch")
    ACTION="Web request"
    TYPE="success"
    DETAIL="Web lookup"
    CURRENT_TASK="Searching the web"
    ;;
  "AskUserQuestion")
    # Extract the question text for display
    QUESTION=$(echo "$INPUT" | grep -o '"question"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"\([^"]*\)".*/\1/' | head -1)
    QUESTION=$(echo "$QUESTION" | tr '"\\' "'/" | head -c 80)
    ACTION="Waiting for input"
    TYPE="waiting"
    DETAIL="${QUESTION:-User question}"
    CURRENT_TASK="${QUESTION:-Waiting for your response...}"
    # Set agent to waiting status
    curl -s -X POST "${TELEMETRY_URL}/api/agents/${AGENT_ID}/heartbeat" \
      -H "Content-Type: application/json" \
      -d @- <<WAITING_EOF > /dev/null 2>&1
{
  "currentTask": "${CURRENT_TASK}",
  "status": "waiting"
}
WAITING_EOF
    # Skip the normal heartbeat below since we already sent one
    SKIP_HEARTBEAT=true
    ;;
  *)
    ACTION="Tool used"
    TYPE="success"
    DETAIL="$TOOL_NAME"
    CURRENT_TASK="Using ${TOOL_NAME}"
    ;;
esac

# Get project name
PROJECT_NAME=$(basename "${CLAUDE_CWD:-$(pwd)}")

# Update agent's currentTask via heartbeat (runs for all tool uses, unless already sent)
if [ "$SKIP_HEARTBEAT" != "true" ]; then
  curl -s -X POST "${TELEMETRY_URL}/api/agents/${AGENT_ID}/heartbeat" \
    -H "Content-Type: application/json" \
    -d @- <<EOF > /dev/null 2>&1
{
  "currentTask": "${CURRENT_TASK}",
  "status": "active"
}
EOF
fi

# Log activity (only for significant tools)
if [[ "$TOOL_NAME" != "Read" && "$TOOL_NAME" != "Glob" && "$TOOL_NAME" != "Grep" ]]; then
  curl -s -X POST "${TELEMETRY_URL}/api/activities" \
    -H "Content-Type: application/json" \
    -d @- <<EOF
{
  "agent": "Claude: ${PROJECT_NAME}",
  "action": "${ACTION}",
  "detail": "${DETAIL}",
  "type": "${TYPE}",
  "provider": "claude",
  "agentId": "${AGENT_ID}",
  "toolName": "${TOOL_NAME}"
}
EOF
fi

# Return empty to allow tool execution to continue
echo "{}"
