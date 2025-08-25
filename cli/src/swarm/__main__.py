from __future__ import annotations
import typer
from rich import print
from pathlib import Path
import time
from . import gitutils as g
from .naming import branch_name
from .state import RunRecord, add_run, get_run
from .claude import ensure_claude_cli, run_headless
from .bootstrap import run_setup_script

app = typer.Typer(no_args_is_help=True)


def ensure_repo() -> Path:
    g.ensure_git()
    try:
        return g.repo_root(Path.cwd())
    except g.GitError:
        raise typer.BadParameter("Not inside a Git repository")


@app.command()
def local(prompt: str):
    """
    Create a temp worktree, run .swarm/setup.sh, run Claude, commit, remove.
    """
    repo = ensure_repo()
    ensure_claude_cli()

    branch = branch_name(prompt)
    repo_slug = repo.name.replace(" ", "-").lower()
    wt_root = Path.home() / ".swarm" / "worktrees" / repo_slug / branch
    g.add_worktree(repo, branch, wt_root)

    # Run repo-owned setup script (no env prep in the CLI)
    try:
        run_setup_script(repo, wt_root)
    except Exception as e:
        print(f"[red]setup failed: {e}[/red]")
        raise typer.Exit(1)

    # Claude
    code = run_headless(prompt, wt_root)
    if code != 0:
        print("[red]Claude run failed[/red]")
        raise typer.Exit(code)

    # Commit
    try:
        commit = g.commit_all(wt_root, f"swarm: {prompt[:60]}")
    except g.GitError as e:
        print(f"[red]git commit failed[/red]\n{e}")
        raise typer.Exit(1)

    # Remove worktree so branch is free
    try:
        g.worktree_remove(repo, wt_root, force=True)
        removed = True
    except g.GitError:
        removed = False

    rec = add_run(
        repo,
        RunRecord(
            id=0,
            run_type="local",
            repo_root=str(repo),
            branch=branch,
            created_at=time.time(),
            worktree_path=str(wt_root),
            commit=commit or None,
        ),
    )

    print(f"[swarm] local id={rec.id} branch={branch}")
    print("[swarm] worktree removed (branch free)"
          if removed else f"[swarm] worktree still present: {wt_root}")


@app.command()
def apply(id: int):
    """
    Switch to the branch created by a previous swarm run (local only).
    """
    repo = ensure_repo()
    rec = get_run(repo, id)
    if not rec:
        print(f"[red]No run with id={id} for this repo[/red]")
        raise typer.Exit(1)

    if rec.run_type != "local":
        print(f"[red]Run {id} is not a local run[/red]")
        raise typer.Exit(1)

    try:
        g.switch_branch(repo, rec.branch)
    except g.GitError as e:
        print(f"[red]{e}[/red]")
        raise typer.Exit(1)

    print(f"[swarm] switched to {rec.branch}")