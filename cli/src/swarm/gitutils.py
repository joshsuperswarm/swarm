from __future__ import annotations
from pathlib import Path
from typing import List, Tuple
import subprocess

class GitError(RuntimeError):
    pass


def run(cmd: List[str], cwd: Path | None = None) -> Tuple[str, str]:
    p = subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )
    if p.returncode != 0:
        raise GitError(p.stderr.strip() or "git error")
    return p.stdout, p.stderr


def which(name: str) -> str | None:
    from shutil import which as _which
    return _which(name)


def ensure_git() -> None:
    if not which("git"):
        raise GitError("git not found on PATH")


def repo_root(start: Path) -> Path:
    out, _ = run(["git", "rev-parse", "--show-toplevel"], cwd=start)
    return Path(out.strip())


def add_worktree(cwd: Path, branch: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    run(["git", "worktree", "add", "-b", branch, str(path)], cwd=cwd)


def commit_all(cwd: Path, msg: str) -> str:
    run(["git", "add", "-A"], cwd=cwd)
    try:
        run(["git", "commit", "-m", msg], cwd=cwd)
    except GitError as e:
        if "nothing to commit" in str(e).lower():
            return ""
        raise
    out, _ = run(["git", "rev-parse", "HEAD"], cwd=cwd)
    return out.strip()


def switch_branch(cwd: Path, branch: str) -> None:
    run(["git", "switch", branch], cwd=cwd)


def worktree_remove(cwd: Path, path: Path, force: bool = True) -> None:
    args = ["git", "worktree", "remove"]
    if force:
        args.append("--force")
    args.append(str(path))
    run(args, cwd=cwd)