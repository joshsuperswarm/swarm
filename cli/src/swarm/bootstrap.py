from __future__ import annotations
from pathlib import Path
import subprocess
import sys

def run_setup_script(repo_root: Path, worktree: Path) -> None:
    script = repo_root / ".swarm" / "setup.sh"
    if not script.exists():
        return
    try:
        script.chmod(script.stat().st_mode | 0o111)
    except Exception:
        pass
    p = subprocess.Popen(
        [str(script)],
        cwd=worktree,
        stdout=sys.stdout,
        stderr=sys.stderr,
        text=True,
    )
    code = p.wait()
    if code != 0:
        raise RuntimeError(f"setup script failed: {script} (exit {code})")