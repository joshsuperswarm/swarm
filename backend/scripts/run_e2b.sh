#!/usr/bin/env bash
# Wrapper to compile/run run_e2b_task.ts

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env (same place as Daytona script)
if [[ -f "$SCRIPT_DIR/../.env" ]]; then
  echo "→ Loading environment variables from backend/.env"
  set -a
  source "$SCRIPT_DIR/../.env"
  set +a
fi

: "${E2B_API_KEY:?Need E2B_API_KEY in .env or env}"
if [[ "$*" == *"--claude"* ]]; then
  : "${ANTHROPIC_API_KEY:?Need ANTHROPIC_API_KEY for --claude}"
else
  : "${OPENAI_API_KEY:?Need OPENAI_API_KEY}"
fi

# Local deps
cd "$SCRIPT_DIR"
if [[ ! -d node_modules ]]; then
  echo "→ Installing local dependencies …"
  npm install  # uses package.json, installs @e2b/code-interpreter
fi

# Run
npx ts-node run_e2b_task.ts "$@"