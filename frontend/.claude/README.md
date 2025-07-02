# Claude Code Custom Commands

This directory contains custom slash commands for Claude Code CLI to streamline git workflows.

## Available Commands

### `/project:push`
**Full git workflow with review**
- Shows current git status and changes
- Stages all changes (`git add .`)
- Creates a descriptive commit with conventional format
- Pushes to remote repository
- Includes change review and confirmation

**Usage:** `/project:push [optional commit context]`

### `/project:push-fast`
**Quick git workflow**
- Streamlined version for rapid commits
- Auto-generates commit messages
- No confirmation prompts
- Stages, commits, and pushes in one flow

**Usage:** `/project:push-fast [optional commit context]`

### `/project:push-safe`
**Conservative git workflow with detailed review**
- Comprehensive change review
- Shows staged and unstaged changes
- Requires confirmation before pushing
- Detailed commit message generation

**Usage:** `/project:push-safe [optional commit context]`

### `/project:commit`
**Commit only (no push)**
- Stages and commits changes
- Does not push to remote
- Good for local development iterations

**Usage:** `/project:commit [optional commit context]`

## How to Use

1. In Claude Code CLI, type `/` to see available commands
2. Select the desired command from the list (they'll appear with `/project:` prefix)
3. Optionally add context after the command: `/project:push fixing login bug`
4. Claude will execute the git workflow automatically

## Command Features

- **Tool Restrictions**: Commands are limited to specific git operations for security
- **Context Awareness**: Uses current git status and recent commits for context
- **Conventional Commits**: Generates properly formatted commit messages
- **Error Handling**: Handles conflicts and provides clear feedback
- **Argument Support**: Accepts additional context via `$ARGUMENTS`

## File Structure

```
.claude/
├── commands/
│   ├── push.md           # Main push command
│   ├── push-fast.md      # Quick push command  
│   ├── push-safe.md      # Safe push with review
│   └── commit.md         # Commit only command
└── README.md            # This documentation
```

## Customization

You can modify these commands by editing the `.md` files. Each command supports:
- YAML frontmatter for configuration
- Bash command execution with `!` prefix
- File references with `@` prefix
- Argument interpolation with `$ARGUMENTS`

## Team Sharing

These commands are checked into git, so they're available to your entire team when they use Claude Code CLI in this project.