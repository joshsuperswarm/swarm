#!/usr/bin/env python3

"""
Claude Code prompt templates for different execution modes.
This module contains all prompt templates used by the Modal sandbox system.
"""

# Mode-specific instruction templates
PLAN_MODE_INSTRUCTIONS = """
Create a concise plan file at `.swarm/task-{task_id}-plan.md` to address the given problem statement.
Include at 2-3 potential implementation strategies.

Do NOT implement the changes, only create the plan.

Your plan should be concise but detailed enough to guide implementation for a less intelligent model.
"""

REVIEW_MODE_INSTRUCTIONS = """
After reviewing the codebase and the task requirements, create a concise
review file at `.swarm/task-{task_id}-review.md` containing:
- Code quality assessment
- Recommendations for improvement (if any)
- Architectural recommendations the code introduces too much complexity
- Only flag security vulnerabilities if they are relevant to the task
"""

EXECUTE_MODE_INSTRUCTIONS = "Implement the requested changes."

# Complete Claude Code prompt template
CLAUDE_PROMPT_TEMPLATE = """You are working on task {task_id}: {prompt}

- The repository is ALREADY checked out to the correct branch, provided by the environment variable `SWARM_BRANCH`.
- Do NOT create, switch, rename, or delete branches.
- Do NOT run `git checkout` or `git switch`. Make all changes on the current branch only.
- Commit locally and push to `origin` (upstream is already configured). Do not force-push.

{mode_instructions}

After completing the work, you MUST output the following markers EXACTLY in this format:

PR_TITLE: <short title>
PR_BODY:
<markdown with summary, test notes, risk, rollout/backout>

These markers are required for an automated PR to be created.
"""
