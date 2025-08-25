# swarm (local-only)

Branch-first automation for Claude Code (local Git worktrees).
Setup is repo-owned: `.swarm/setup.sh`.

## Zero-install tryout (from a checkout)

```bash
uvx --from . swarm --help
```

## Environment

```bash
export ANTHROPIC_API_KEY=sk-...
# 'claude' CLI must be on PATH.
```

## Commands

```bash
# Create a worktree under ~/.swarm/worktrees/<repo>/<branch>,
# run .swarm/setup.sh, run Claude, commit, remove worktree
swarm local "Add a claude_was_here.txt file"

# Switch to the branch created by run id 1
swarm apply 1
```

## Global install

```bash
uv tool install .
# Then:
swarm local "..."
```
