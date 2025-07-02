---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git push:*), Bash(git log:*), Bash(git diff:*)
description: Safe git push with review - stage, review changes, commit, and push with confirmation
---

# Safe Git Push with Review

## Current Repository Status
!`git status`

## Staged Changes
!`git diff --cached`

## Unstaged Changes  
!`git diff`

## Recent Commit History
!`git log --oneline -3`

## Your Task

Please execute the following git workflow with careful review:

1. **Review the changes** shown above and provide a summary
2. **Stage all changes** using `git add .`
3. **Show what will be committed** using `git diff --cached`
4. **Create a descriptive commit message** that:
   - Uses conventional commit format (feat:, fix:, docs:, refactor:, etc.)
   - Accurately describes the changes
   - Is concise but informative
   - Includes the standard Claude Code attribution footer
5. **Create the commit**
6. **Push to remote** using `git push`

Before pushing, please show me:
- A summary of what changed
- The proposed commit message
- Confirmation that you're ready to push

Additional context for commit message: $ARGUMENTS