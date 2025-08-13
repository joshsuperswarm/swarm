#!/bin/bash

# Setup script to install git hooks for consistent commit checks
# Run this after cloning the repository to enable pre-commit checks

set -e

# Get the git root directory
GIT_ROOT=$(git rev-parse --show-toplevel)
SCRIPTS_DIR="$GIT_ROOT/scripts"
HOOKS_DIR="$GIT_ROOT/.git/hooks"

echo "Setting up git hooks..."

# Check if we have the pre-commit hook in scripts/
if [ ! -f "$SCRIPTS_DIR/pre-commit" ]; then
    echo "Error: pre-commit hook not found in scripts/ directory"
    echo "Please ensure scripts/pre-commit exists"
    exit 1
fi

# Copy the pre-commit hook to .git/hooks/
cp "$SCRIPTS_DIR/pre-commit" "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-commit"

echo "✓ Pre-commit hook installed successfully"
echo "✓ Commit checks will now run automatically before each commit"
echo "  - Rust compilation check"
echo "  - TypeScript compilation check" 
echo "  - Code formatting (rustfmt, prettier, ruff)"