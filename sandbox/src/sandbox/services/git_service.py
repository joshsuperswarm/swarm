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