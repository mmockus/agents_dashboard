#!/bin/bash
# Utility to clear all agents from the telemetry server
# Usage: ./clear-dashboard.sh

TELEMETRY_URL="${TELEMETRY_URL:-http://localhost:3001}"

echo "Clearing all agents from ${TELEMETRY_URL}..."
curl -X DELETE "${TELEMETRY_URL}/api/agents"
echo -e "\nDone. Dashboard should now be empty."