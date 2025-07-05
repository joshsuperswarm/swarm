#!/usr/bin/env bash
# Wrapper that compiles/runs the TypeScript file and passes your prompt.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ----- LOAD .ENV FILE -------------------------------------------------------
if [[ -f "$SCRIPT_DIR/../.env" ]]; then
  echo "→ Loading environment variables from backend/.env"
  set -a  # automatically export all variables
  source "$SCRIPT_DIR/../.env"
  set +a  # disable auto-export
fi

# ----- REQUIRED -------------------------------------------------------------
: "${DAYTONA_API_KEY:?Need DAYTONA_API_KEY in .env or environment}"

# Check which tool is being used
if [[ "$*" == *"--claude"* ]]; then
  : "${ANTHROPIC_API_KEY:?Need ANTHROPIC_API_KEY in .env or environment when using --claude}"
else
  : "${OPENAI_API_KEY:?Need OPENAI_API_KEY in .env or environment}"
fi

# ----- LOCAL INSTALL --------------------------------------------------------
if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
  echo "→ Installing dependencies locally (first time setup)…"
  cd "$SCRIPT_DIR"
  npm install
  cd - >/dev/null
fi

# ----- RUN -------------------------------------------------------------------
cd "$SCRIPT_DIR"
npx ts-node run_daytona_task.ts "$@"