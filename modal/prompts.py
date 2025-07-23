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

{mode_instructions}

After completing the task, you MUST output the following markers in this exact format:

COMMIT_MESSAGE_TITLE: Your concise commit title here
COMMIT_MESSAGE_BODY: Your concise commit message body here
PR_TITLE: Your concise pull request title here
PR_BODY: Your very concise pull request description here

The system requires these markers to automatically generate commit messages and pull
requests. Without them, the task will fail."""
