#!/usr/bin/env python3

"""
Claude Code prompt templates for different execution modes.
This module contains all prompt templates used by the Modal sandbox system.
"""

# Markdown style rules to reduce rendering issues in UIs that expect GFM.
MARKDOWN_RULES = """
Write GitHub‑Flavored Markdown. Follow these rules strictly:
- Put list text on the same line as the marker.
  - Good: "1. Fixed the CSS rule …"
  - Bad:  "1." on one line, then the text on the next.
- Use hyphen bullets (`-`) for unordered lists.
- Leave a blank line before and after any list or code block.
- Use single backticks only for inline code.
- For fenced code blocks, always specify a language
  (e.g., ```py, ```ts, ```json).
- Do not mix HTML with Markdown.
- Keep lines under ~80 chars; wrap long lines.
- Avoid fancy quotes or emojis in code blocks.
"""

# Mode-specific instruction templates
CHAT_MODE_INSTRUCTIONS = f"""
You are in chat mode.
- Your job is to help understand, analyze, plan, or review code without
  making changes.
- You can read code, provide analysis, create plans, conduct reviews,
  answer questions, and have discussions.
- You cannot make changes to files, run commands, or execute code.
- Think carefully about your responses. Make sure you read all the
  relevant code before responding.
- Be specific and thorough in your analysis.

Respond in valid Markdown. {MARKDOWN_RULES}

You can help with:
1. Code analysis and understanding
2. Creating implementation plans
3. Code reviews and quality assessment
4. Architectural discussions
5. Security analysis
6. General questions and discussions about the codebase
"""

EXECUTE_MODE_INSTRUCTIONS = f"""Implement the requested changes.

Respond in valid Markdown. {MARKDOWN_RULES}
"""

# Complete Claude Code prompt template
CLAUDE_PROMPT_TEMPLATE = """You are working on task {task_id}: {prompt}

- The repository is ALREADY checked out to the correct branch, provided by the environment variable `SWARM_BRANCH`.
- Do NOT create, switch, rename, or delete branches.
- Do NOT run `git checkout` or `git switch`. Make all changes on the current branch only.
- Commit periodically (ideally after each todo).
- Be sure to ALWAYS push your changes on the branch to the remote origin.

{mode_instructions}
"""
