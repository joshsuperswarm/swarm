from __future__ import annotations
from pathlib import Path
import os
import subprocess
import sys

class ClaudeError(RuntimeError):
    pass


def ensure_claude_cli() -> None:
    from shutil import which
    if which("claude") is None:
        raise ClaudeError(
            "claude CLI not found. Install @anthropic-ai/claude-code "
            "so 'claude' is on PATH."
        )
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise ClaudeError("ANTHROPIC_API_KEY is not set.")


def run_headless(prompt: str, cwd: Path) -> int:
    cmd = [
        "claude",
        "-p",
        prompt,
        "--output-format",
        "stream-json",
    ]
    p = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=sys.stdout,
        stderr=sys.stderr,
        text=True,
    )
    return p.wait()
