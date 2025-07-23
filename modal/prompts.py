#!/usr/bin/env python3

"""
Claude Code prompt templates for different execution modes.
This module contains all prompt templates used by the Modal sandbox system.
"""

# Mode-specific instruction templates
PLAN_MODE_INSTRUCTIONS = """
After analyzing the codebase and understanding the requirements, create a detailed plan file at `.swarm/task-{task_id}-plan.md` containing:
- Problem analysis and approach
- Implementation strategy and steps
- Potential challenges and considerations
- Architecture or design decisions

Do NOT implement the changes, only create the plan. Focus on thorough analysis and strategic planning.
"""

REVIEW_MODE_INSTRUCTIONS = """
After reviewing the codebase and the task requirements, create a comprehensive review file at `.swarm/task-{task_id}-review.md` containing:
- Code quality assessment
- Issues and potential problems identified
- Security considerations
- Performance implications
- Recommendations for improvement

Focus on analysis and recommendations, not implementation.
"""

EXECUTE_MODE_INSTRUCTIONS = "Implement the requested changes."

# Complete Claude Code prompt template
CLAUDE_PROMPT_TEMPLATE = """Please work on this task {task_id}: {prompt}.

{mode_instructions}

After completing the task, you MUST output the following markers in this exact format:

COMMIT_MESSAGE_TITLE: Your commit title here
COMMIT_MESSAGE_BODY: Your detailed commit message body here
PR_TITLE: Your pull request title here
PR_BODY: Your detailed pull request description here
DONE

The system requires these markers to automatically generate commit messages and pull requests. Without them, the task will fail."""
