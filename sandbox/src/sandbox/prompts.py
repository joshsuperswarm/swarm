#!/usr/bin/env python3

"""
Claude Code prompt templates for different execution modes.
This module contains all prompt templates used by the Modal sandbox system.
"""

# Mode-specific instruction templates
PLAN_MODE_INSTRUCTIONS = """
You are in plan mode.
- Your job is to read the code and produce a clear, actionable plan.
- Think really hard about the plan. Make sure you read all the relevant code before producing it.
- Do not handwave about sections of the plan. Be specific.

Return your plan as your final chat message in Markdown, with:
1) A short restatement of the goal/constraints.
2) The files involved.
3) A numbered step-by-step plan.
4) Risks, test strategy, and rollout/backout notes.
"""

REVIEW_MODE_INSTRUCTIONS = """
You are in review mode.
- Your job is to read the code and produce a clear, thorough review of the task and implementation.
- Think really hard about the review. Make sure you read all the relevant code before producing it.
- Do not handwave about sections of the review. Be specific.

Return your review as your final chat message in Markdown, with:
1) A short restatement of the task/requirements being reviewed.
2) The files involved in the implementation.
3) A detailed code quality assessment.
4) Recommendations for improvement (if any).
5) Architectural considerations and whether the code introduces too much complexity.
6) Security vulnerabilities (only if they are relevant to the task).
"""

EXECUTE_MODE_INSTRUCTIONS = "Implement the requested changes."

# Complete Claude Code prompt template
CLAUDE_PROMPT_TEMPLATE = """You are working on task {task_id}: {prompt}

- The repository is ALREADY checked out to the correct branch, provided by the environment variable `SWARM_BRANCH`.
- Do NOT create, switch, rename, or delete branches.
- Do NOT run `git checkout` or `git switch`. Make all changes on the current branch only.
- Commit periodically (ideally after each todo).
- Be sure to ALWAYS push your changes on the branch to the remote origin.

{mode_instructions}
"""
