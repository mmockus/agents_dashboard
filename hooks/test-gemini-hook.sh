#!/bin/bash
# Test script for gemini-telemetry-tool-use.sh
# Usage: ./test-gemini-hook.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_SCRIPT="$SCRIPT_DIR/gemini-telemetry-tool-use.sh"
END_HOOK_SCRIPT="$SCRIPT_DIR/gemini-telemetry-session-end.sh"
TELEMETRY_URL="${TELEMETRY_URL:-http://localhost:3001}"

# Ensure the hook is executable
if [ ! -x "$HOOK_SCRIPT" ]; then
  echo "Making hook script executable..."
  chmod +x "$HOOK_SCRIPT"
fi
if [ ! -x "$END_HOOK_SCRIPT" ]; then
  echo "Making end hook script executable..."
  chmod +x "$END_HOOK_SCRIPT"
fi

# Setup mock session
SESSION_ID="test-gemini-$(date +%s)"
echo "$SESSION_ID" > /tmp/gemini-agent-session-id
export GEMINI_CWD="$(pwd)"

# Register the mock agent first (so it appears in the dashboard)
AGENT_ID="gemini-${SESSION_ID:0:12}"
echo "Registering mock agent: $AGENT_ID"
curl -s -X POST "${TELEMETRY_URL}/api/agents/${AGENT_ID}" \
  -H "Content-Type: application/json" \
  -d "{
  \"name\": \"Gemini: Test Session\",
  \"provider\": \"gemini\",
  \"type\": \"assistant\",
  \"status\": \"active\",
  \"model\": \"gemini-2.0-flash\",
  \"currentTask\": \"Starting test suite\",
  \"cwd\": \"$(pwd)\",
  \"subAgents\": []
}" > /dev/null

echo "1. Testing Bash Tool (Command Execution)..."
cat <<EOF | "$HOOK_SCRIPT"
{
  "tool_name": "Bash",
  "command": "ls -la",
  "description": "Listing project files"
}
EOF

echo -e "\n2. Testing Edit Tool (File Modification)..."
cat <<EOF | "$HOOK_SCRIPT"
{
  "tool_name": "Edit",
  "file_path": "src/App.jsx",
  "description": "Updating component logic"
}
EOF

echo -e "\n3. Testing AskUserQuestion (Waiting State)..."
cat <<EOF | "$HOOK_SCRIPT"
{
  "tool_name": "AskUserQuestion",
  "question": "Do you want to deploy these changes?"
}
EOF

echo -e "\n4. Simulating Session End (Agent should disappear after this)..."
sleep 3 # Give time to see the 'waiting' state

"$END_HOOK_SCRIPT"

echo -e "\nTest complete. The 'Gemini: Test Session' agent should now be removed from the active view."