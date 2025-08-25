from __future__ import annotations
import typer
from rich import print
from pathlib import Path
import time
from . import gitutils as g
from .naming import branch_name
from .state import RunRecord, add_run, get_run
from .claude import ensure_claude_cli, run_headless

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
    Create a temp worktree, run Claude, commit, remove worktree, record id.
    """
    repo = ensure_repo()
    ensure_claude_cli()

    branch = branch_name(prompt)
    repo_slug = repo.name.replace(" ", "-").lower()
    wt_root = Path.home() / ".swrm" / "worktrees" / repo_slug / branch

    # Create worktree on a new branch
    g.add_worktree(repo, branch, wt_root)

    # Run Claude in the worktree
    code = run_headless(prompt, wt_root)
    if code != 0:
        print("[red]Claude run failed[/red]")
        # Leave the worktree so user can inspect; don't remove
        raise typer.Exit(code)

    # Commit changes
    commit = g.commit_all(wt_root, f"swrm: {prompt[:60]}")

    # Remove worktree so the branch is free to switch in main repo
    try:
        g.worktree_remove(repo, wt_root, force=True)
        removed = True
    except g.GitError as e:
        removed = False
        print(
            "[yellow]Could not remove worktree automatically. "
            f"Remove manually: git worktree remove --force {wt_root}[/yellow]"
        )

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

    print(f"[swrm] local id={rec.id} branch={branch}")
    if removed:
        print("[swrm] worktree removed (branch free)")
    else:
        print("[swrm] worktree still present:", wt_root)


@app.command()
def apply(id: int):
    """
    Switch to the branch created by a previous swrm run (local only).
    """
    repo = ensure_repo()
    rec = get_run(repo, id)
    if not rec:
        print(f"[red]No run with id={id} for this repo[/red]")
        raise typer.Exit(1)

    if rec.run_type != "local":
        print(f"[red]Run {id} is not a local run[/red]")
        raise typer.Exit(1)

    # Try to switch. If branch is still checked out in a worktree, Git
    # will error. Suggest removing the worktree.
    try:
        g.switch_branch(repo, rec.branch)
    except g.GitError as e:
        msg = str(e)
        if "already checked out" in msg.lower():
            print(
                "[red]Branch is checked out in a worktree.[/red]\n"
                f"Remove it first:\n"
                f"  git worktree remove --force {rec.worktree_path}"
            )
        else:
            print(f"[red]{e}[/red]")
        raise typer.Exit(1)

    print(f"[swrm] switched to {rec.branch}")