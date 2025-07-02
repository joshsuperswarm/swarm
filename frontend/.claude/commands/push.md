---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git push:*), Bash(git log:*)
description: Stage all changes, create a commit, and push to remote repository
---

# Git Push Automation

## Current Repository Status
!`git status`

## Current Changes
!`git diff --cached`
!`git diff`

## Recent Commits (for context)
!`git log --oneline -3`

## Your Task
Based on the current changes shown above, please:

1. **Stage all changes** using `git add .`
2. **Create a commit** with an appropriate commit message that:
   - Follows conventional commit format (e.g., "feat:", "fix:", "docs:", "refactor:", etc.)
   - Summarizes the changes clearly and concisely
   - Includes the Claude Code footer as specified in the commit guidelines
3. **Push the changes** to the remote repository using `git push`

If there are any conflicts or issues during the push process, please handle them appropriately and provide clear feedback.

Additional context or commit message details: $ARGUMENTS