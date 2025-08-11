import logging
from fastapi import HTTPException

from ..domain.models import WorkflowReq, ExecReq, ExecResp, PushChangesReq
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
    
    def push_advanced(self, sandbox_id: str, req: PushChangesReq) -> ExecResp:
        """Push changes to GitHub branch with proper commit information."""
        try:
            self.logger.info(f"Pushing changes to branch {req.branch} in sandbox {sandbox_id}")

            # We need to do this step by step using the process service
            # Step 1: Change to repository directory and stage all changes
            add_req = ExecReq(
                cmd=["git", "add", "-A"],
                cwd=req.repo_path
            )
            add_resp = self.process_service.exec(sandbox_id, add_req)

            # For advanced push, we'll create a compound command
            commit_msg_content = f"{req.commit_title}\n\n{req.commit_body}"
            
            # Create a shell script that does all the git operations
            push_script = f"""
            cd {req.repo_path}
            
            # Write commit message to temporary file
            cat > /tmp/commit_message_{req.task_id} << 'EOF'
{commit_msg_content}
EOF
            
            # Commit changes
            git commit -F /tmp/commit_message_{req.task_id}
            
            # Create/switch to new branch
            git checkout -B {req.branch}
            
            # Push the branch to origin
            git push -u origin {req.branch}
            
            # Clean up temporary file
            rm -f /tmp/commit_message_{req.task_id}
            """
            
            exec_req = ExecReq(
                cmd=["bash", "-c", push_script],
                cwd=req.repo_path
            )
            
            self.logger.info(f"Successfully pushed changes to branch {req.branch}")
            return self.process_service.exec(sandbox_id, exec_req)

        except Exception as e:
            self.logger.error(f"Failed to push changes: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to push changes: {str(e)}")
    
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