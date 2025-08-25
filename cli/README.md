# swrm (local-only)

Branch-first automation for Claude Code (local worktrees), with a simple
record of runs so you can switch to the resulting branch later.

## Install uv

- macOS/Linux:
  curl -LsSf https://astral.sh/uv/install.sh | sh
- Windows (PowerShell):
  irm https://astral.sh/uv/install.ps1 | iex

## Zero-install tryout (from a checkout)

```bash
uvx --from . swrm --help
```

## Environment

```bash
export ANTHROPIC_API_KEY=sk-...
# 'claude' CLI must be available on PATH.
```

## Commands

```bash
# Create a worktree under ~/.swrm, run Claude, commit, remove worktree
swrm local "Improve error handling in parser"

# Switch to the branch created by run id 1
swrm apply 1
```

## Notes

- After `swrm local`, the worktree is removed so the branch is free to
  switch to in your main repo. If removal fails, the command tells you
  how to remove it manually.
- If you want to keep the worktree around instead, you can comment out
  the removal in `__main__.py` (or add a `--keep-worktree` flag later).

## How to run with uv

- Try without installing: `uvx --from . swrm local "Fix tests"`.
- Install globally: `uv tool install .` then run `swrm ...`.