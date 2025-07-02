---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git push:*), Bash(git log:*)
description: Quick git workflow - stage, commit with generated message, and push
---

# Quick Git Push

## Repository State
!`git status`
!`git diff --stat`

## Recent History
!`git log --oneline -2`

## Task
Execute the complete git workflow:
1. Stage all changes (`git add .`)
2. Generate an appropriate commit message based on the changes
3. Create the commit with Claude Code attribution
4. Push to remote repository

Commit message context: $ARGUMENTS

Keep it fast and efficient - no confirmations needed.