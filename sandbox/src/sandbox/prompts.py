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
CLAUDE_PROMPT_TEMPLATE = """Please work on this task {task_id}: {prompt}.

Before starting work on the task, create a new branch using the `SWARM_BRANCH` environment variable as the name of the branch.
Once you have completed the task, push the branch to the remote repository.

{mode_instructions}

After completing the task, you MUST output the following markers in this exact format:

PR_TITLE: <short title>
PR_BODY:
<markdown with summary, test notes, risk, rollout/backout>

The system requires these PR markers to automatically generate pull requests. 
Do NOT emit COMMIT_MESSAGE_* markers as the system no longer uses them.
Without the PR markers, the task will fail."""

# Then, using the GitHub CLI, create a pull request for the branch.
