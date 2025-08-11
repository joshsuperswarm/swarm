import logging
import re
import shlex
from fastapi import HTTPException

from ..domain.models import WorkflowReq, ExecReq, ExecResp
from ..utils.logging import get_logger
from .process_service import ProcessService


class GitService:
    """Service for git operations."""
    
    def __init__(self, process_service: ProcessService):
        self.process_service = process_service
        self.logger = get_logger(__name__)
    
    _BRANCH_SAFE = re.compile(r"^(?!/)(?!.*//)[A-Za-z0-9._/-]{1,200}(?<!/)$")
    _BAD_CHARS = set(" @{}~^:\\")
    
    @staticmethod
    def validate_branch(name: str) -> None:
        if not name:
            raise HTTPException(status_code=400, detail="branch is required")
        if not GitService._BRANCH_SAFE.match(name) or any(ch in GitService._BAD_CHARS for ch in name):
            raise HTTPException(status_code=400, detail=f"Invalid branch name: {name}")
    
    def ensure_branch_checked_out(
        self,
        sandbox_id: str,
        repo_dir: str,
        branch: str,
        base_ref: str = "origin/main",
    ) -> ExecResp:
        GitService.validate_branch(branch)

        script = f"""
        set -euo pipefail
        git -C {shlex.quote(repo_dir)} fetch --prune

        if git -C {shlex.quote(repo_dir)} ls-remote --exit-code --heads origin {shlex.quote(branch)} >/dev/null 2>&1; then
          # Remote branch exists: track it exactly
          git -C {shlex.quote(repo_dir)} checkout -B {shlex.quote(branch)} origin/{shlex.quote(branch)}
        else
          # Create from base and publish
          git -C {shlex.quote(repo_dir)} checkout -B {shlex.quote(branch)} {shlex.quote(base_ref)}
          git -C {shlex.quote(repo_dir)} push -u origin {shlex.quote(branch)}
        fi

        # Sanity: show where we are
        git -C {shlex.quote(repo_dir)} rev-parse --abbrev-ref HEAD
        """
        exec_req = ExecReq(cmd=["bash", "-lc", script], cwd=repo_dir)
        return self.process_service.exec(sandbox_id, exec_req)
    
    def configure_global(self, sandbox_id: str, user_name: str, user_email: str) -> ExecResp:
        """Configure Git user settings."""
        if not user_name or not user_email:
            raise HTTPException(
                status_code=400, detail="user_name and user_email are required"
            )

        # Commands are now automatically run as swarm user via exec_command
        exec_req = ExecReq(
            cmd=[
                "bash",
                "-c",
                f"git config --global user.name '{user_name}' && git config --global user.email '{user_email}'",
            ],
            cwd="/home/swarm",  # Git config is global, so any directory works
        )
        return self.process_service.exec(sandbox_id, exec_req)
    
    def push_simple(self, sandbox_id: str, repo_dir: str, branch: str) -> ExecResp:
        """Push changes to the repository."""
        exec_req = ExecReq(
            cmd=[
                "bash",
                "-c",
                f"git add . && git commit -m 'Auto-commit changes' && git push origin {branch}",
            ],
            cwd=repo_dir,
        )
        return self.process_service.exec(sandbox_id, exec_req)
    
    def clone_repo(self, sandbox_id: str, req: WorkflowReq) -> ExecResp:
        """Clone a repository to the sandbox."""
        if not req.repo_url:
            raise HTTPException(status_code=400, detail="repo_url is required")

        # Extract repo name from URL for folder name
        repo_name = req.repo_url.rstrip("/").split("/")[-1]
        if repo_name.endswith(".git"):
            repo_name = repo_name[:-4]

        # Commands are now automatically run as swarm user via exec_command
        exec_req = ExecReq(
            cmd=[
                "git",
                "clone",
                req.repo_url,
                f"/home/swarm/{repo_name}",
                "-b",
                req.branch or "main",
            ],
            cwd="/home/swarm",
        )
        return self.process_service.exec(sandbox_id, exec_req)