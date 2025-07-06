#!/bin/bash

# Tail output of the most recent task using Daytona API
# This script connects to the database to find the most recent task,
# then uses the Daytona API to stream the command output
#
# Usage: ./tail_task_output.sh [task_id]
#   If task_id is provided, it will tail that specific task
#   Otherwise, it will tail the most recent task
#
# Requirements:
#   - Docker (for PostgreSQL client)
#   - curl
#   - jq
#   - .env file with DAYTONA_URL, DAYTONA_API_KEY, DATABASE_URL
#
# Installation on macOS:
#   brew install curl jq

set -e

# Load environment variables from .env file
if [ -f "$(dirname "$0")/../.env" ]; then
    export $(cat "$(dirname "$0")/../.env" | grep -v '^#' | xargs)
fi

# Check required environment variables
if [ -z "$DAYTONA_URL" ] || [ -z "$DAYTONA_API_KEY" ] || [ -z "$DATABASE_URL" ]; then
    echo "Error: Required environment variables not set"
    echo "Please ensure DAYTONA_URL, DAYTONA_API_KEY, and DATABASE_URL are configured"
    exit 1
fi

# Check if required tools are available
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker."
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo "Error: curl is not installed."
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Please install jq for JSON processing."
    exit 1
fi

echo "→ Finding most recent task with Daytona workspace..."

# Query database for most recent task with Daytona workspace info
TASK_DATA=$(docker exec -i swarm-postgres psql -U swarm -d swarm -t -c "
    SELECT
        id || '|' ||
        COALESCE(title, 'Untitled') || '|' ||
        daytona_workspace_id || '|' ||
        COALESCE(daytona_session_id, '') || '|' ||
        COALESCE(daytona_command_id, '') || '|' ||
        status || '|' ||
        COALESCE(description, '')
    FROM tasks
    WHERE daytona_workspace_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1;
" 2>/dev/null)

if [ -z "$TASK_DATA" ] || [ "$TASK_DATA" = " " ]; then
    echo "✗ No tasks found with Daytona workspace"
    exit 1
fi

# Parse task data using pipe delimiter
TASK_ID=$(echo "$TASK_DATA" | cut -d'|' -f1 | xargs)
TASK_TITLE=$(echo "$TASK_DATA" | cut -d'|' -f2 | xargs)
WORKSPACE_ID=$(echo "$TASK_DATA" | cut -d'|' -f3 | xargs)
SESSION_ID=$(echo "$TASK_DATA" | cut -d'|' -f4 | xargs)
COMMAND_ID=$(echo "$TASK_DATA" | cut -d'|' -f5 | xargs)
STATUS=$(echo "$TASK_DATA" | cut -d'|' -f6 | xargs)
DESCRIPTION=$(echo "$TASK_DATA" | cut -d'|' -f7 | xargs)

echo "✓ Found task: #$TASK_ID - $TASK_TITLE"
echo "  Status: $STATUS"
echo "  Workspace ID: $WORKSPACE_ID"

# Display the command that would be invoked
if [ -n "$DESCRIPTION" ]; then
    echo ""
    echo "→ Claude command that was invoked:"
    # Reconstruct the Claude command based on the task description
    CLAUDE_PROMPT="Please work on task ID $TASK_ID: $DESCRIPTION."
    echo "  claude -p \"$CLAUDE_PROMPT\" \\"
    echo "      --verbose \\"
    echo "      --output-format stream-json \\"
    echo "      --max-turns 1 \\"
    echo "      --dangerously-skip-permissions \\"
    echo "      < /dev/null"
    echo ""
fi

if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "" ]; then
    echo "✗ No session ID found for this task"
    exit 1
fi

echo "  Session ID: $SESSION_ID"

# Set up headers for Daytona API
AUTH_HEADER="Authorization: Bearer $DAYTONA_API_KEY"
CONTENT_TYPE="Content-Type: application/json"

# Add organization header if set
if [ -n "$DAYTONA_ORGANIZATION_ID" ]; then
    ORG_HEADER="X-Daytona-Organization-ID: $DAYTONA_ORGANIZATION_ID"
    HEADERS=(-H "$AUTH_HEADER" -H "$CONTENT_TYPE" -H "$ORG_HEADER")
else
    HEADERS=(-H "$AUTH_HEADER" -H "$CONTENT_TYPE")
fi

# Function to get session logs
get_session_logs() {
    local session_id="$1"
    local url="$DAYTONA_URL/toolbox/$WORKSPACE_ID/toolbox/process/session/$session_id"

    echo "→ Fetching session logs from: $url"

    # Get session info including logs
    RESPONSE=$(curl -s "${HEADERS[@]}" "$url" 2>/dev/null)

    if [ $? -ne 0 ]; then
        echo "✗ Failed to connect to Daytona API"
        return 1
    fi

    # Check if response contains error
    if echo "$RESPONSE" | jq -e '.error // .message' &>/dev/null; then
        ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // .message')
        echo "✗ API Error: $ERROR_MSG"
        return 1
    fi

    # Extract and display logs
    if echo "$RESPONSE" | jq -e '.logs' &>/dev/null; then
        echo "$RESPONSE" | jq -r '.logs[]' 2>/dev/null || echo "No logs available"
    else
        echo "⚠ No logs field found in response"
        echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    fi
}

# Function to get command output if command ID is available
get_command_output() {
    local command_id="$1"
    local url="$DAYTONA_URL/toolbox/$WORKSPACE_ID/toolbox/process/session/$SESSION_ID/command/$command_id/logs"

    echo "→ Fetching command output from: $url"

    RESPONSE=$(curl -s "${HEADERS[@]}" "$url" 2>/dev/null)

    if [ $? -ne 0 ]; then
        echo "✗ Failed to connect to Daytona API"
        return 1
    fi

    # Check if response contains error
    if echo "$RESPONSE" | jq -e '.error // .message' &>/dev/null; then
        ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // .message')
        echo "✗ API Error: $ERROR_MSG"
        echo "→ Trying session logs instead..."
        get_session_logs "$SESSION_ID"
        return 1
    fi

    # Display the response directly (logs are usually plain text)
    if [ -n "$RESPONSE" ]; then
        echo "$RESPONSE"
    else
        echo "⚠ No output available"
    fi
}

# Function to stream command logs with follow=true
stream_command_logs() {
    local command_id="$1"
    local url="$DAYTONA_URL/toolbox/$WORKSPACE_ID/toolbox/process/session/$SESSION_ID/command/$command_id/logs?follow=true"

    echo "→ Streaming command logs from: $url"
    echo "============================================"

    # Stream logs with follow=true
    curl -s "${HEADERS[@]}" "$url" 2>/dev/null

    if [ $? -ne 0 ]; then
        echo "✗ Failed to stream logs, falling back to polling..."
        return 1
    fi
}

# Function to tail logs with polling
tail_logs() {
    local last_log_count=0
    local use_session_logs=false

    echo "→ Starting log tail (press Ctrl+C to stop)..."
    echo "============================================"

    # Try streaming first if we have a command ID
    if [ -n "$COMMAND_ID" ] && [ "$COMMAND_ID" != "" ]; then
        if stream_command_logs "$COMMAND_ID"; then
            return 0
        fi
        echo "→ Streaming failed, falling back to polling..."
    fi

    while true; do
        if [ "$use_session_logs" = true ] || [ -z "$COMMAND_ID" ] || [ "$COMMAND_ID" = "" ]; then
            # Use session logs
            get_session_logs "$SESSION_ID"
        else
            # Try to get command output first
            if ! get_command_output "$COMMAND_ID"; then
                echo "→ Command output not available, switching to session logs..."
                use_session_logs=true
            fi
        fi

        echo ""
        echo "--- $(date) ---"
        sleep 5
    done
}

# Check workspace status first
echo "→ Checking workspace status..."
WORKSPACE_STATUS=$(curl -s "${HEADERS[@]}" "$DAYTONA_URL/sandbox/$WORKSPACE_ID" | jq -r '.status // "unknown"' 2>/dev/null)
echo "  Workspace Status: $WORKSPACE_STATUS"

if [ "$WORKSPACE_STATUS" = "stopped" ] || [ "$WORKSPACE_STATUS" = "failed" ]; then
    echo "⚠ Workspace is not running, showing last available logs..."
    if [ -n "$COMMAND_ID" ] && [ "$COMMAND_ID" != "" ]; then
        get_command_output "$COMMAND_ID"
    else
        get_session_logs "$SESSION_ID"
    fi
    exit 0
fi

# Start tailing logs
tail_logs
