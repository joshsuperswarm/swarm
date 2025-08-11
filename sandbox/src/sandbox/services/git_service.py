import logging
from fastapi import HTTPException

from ..domain.models import WorkflowReq, ExecReq, ExecResp
from ..utils.logging import get_logger
from .process_service import ProcessService


class GitService:
    """Service for git operations."""
    
    def __init__(self, process_service: ProcessService):
        self.process_service = process_service
        self.logger = get_logger(__name__)
    
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