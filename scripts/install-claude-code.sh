#!/usr/bin/env bash
set -e

echo "Installing Claude Code..."

# Check if it's already installed
if command -v claude >/dev/null 2>&1; then
  echo "Claude Code already installed. Skipping."
else
  npm install -g @anthropic-ai/claude-code
  echo "Claude Code installed."
fi
