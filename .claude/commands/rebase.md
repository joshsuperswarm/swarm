---
allowed-tools: Bash
description: Merge PR with rebase, checkout main, and pull latest changes
---

# Rebase and Update Main

## Task

Execute the following Git operations in sequence:

1. Merge the current PR using rebase strategy
2. Switch to main branch
3. Pull latest changes from remote

Run these commands sequentially:

1. `gh pr merge --rebase`
2. `git checkout main`
3. `git pull`

Context: $ARGUMENTS
