import modal
import uuid
import logging
from typing import Optional
from fastapi import HTTPException

from ..domain.models import CreateSandboxReq, CreateSandboxResp, SandboxStatusResp
from ..domain.errors import SandboxNotFoundError
from ..adapters.modal_adapter import ModalAdapter
from ..utils.config import DEFAULT_TIMEOUT_SECONDS, SWARM_HOME
from ..utils.logging import get_logger
from .storage import InMemoryStorage


class SandboxService:
    """Service for sandbox lifecycle management."""
    
    def __init__(self, storage: InMemoryStorage, app_modal: modal.App, swarm_dev_img):
        self.storage = storage
        self.app_modal = app_modal
        self.swarm_dev_img = swarm_dev_img
        self.logger = get_logger(__name__)
    
    def create(self, req: CreateSandboxReq) -> CreateSandboxResp:
        """Create a new sandbox and clone the repository."""
        try:
            # Create unique sandbox ID
            sandbox_id = str(uuid.uuid4())

            # Create Modal sandbox using pre-built image with all tools installed
            sb = modal.Sandbox.create(
                image=self.swarm_dev_img,
                workdir=SWARM_HOME,
                timeout=DEFAULT_TIMEOUT_SECONDS,
                app=self.app_modal,
                verbose=True,
            )

            # Store in memory
            self.storage.sandboxes[sandbox_id] = sb
            self.storage.processes[sandbox_id] = {}

            # swarm user is already created in the pre-built image
            self.logger.info("Using pre-built image with swarm user already configured")

            # Clone repository (git is already installed via image)
            self._clone_repository(sb, req, sandbox_id)
            
            # Always configure git user settings (author is now required)
            self._configure_git(sb, req)

            # Setup development tools (pre-commit hooks, etc.)
            self._setup_dev_tools(sb, req)

            # Run backend/scripts/start_postgres_and_migrate.sh
            self._bootstrap_postgres(sb, req)

            self.logger.info(f"Created sandbox {sandbox_id} with repo {req.repo_url}")

            return CreateSandboxResp(
                sandbox_id=sandbox_id, hostname=f"sandbox-{sandbox_id}"
            )
        except Exception as e:
            self.logger.error(f"Failed to create sandbox: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to create sandbox: {str(e)}"
            )
    
    def terminate(self, sandbox_id: str) -> None:
        """Terminate a sandbox."""
        try:
            sb = self.get(sandbox_id)

            # Kill all processes first and clean up logs
            if sandbox_id in self.storage.processes:
                for proc_id, proc_info in self.storage.processes[sandbox_id].items():
                    try:
                        proc = (
                            proc_info["proc"] if isinstance(proc_info, dict) else proc_info
                        )
                        if hasattr(proc, "terminate"):
                            proc.terminate()
                        elif hasattr(proc, "kill"):
                            proc.kill()
                    except Exception as e:
                        self.logger.warning(f"Could not terminate process {proc_id}: {str(e)}")

                    # Clean up log buffer for this process
                    buffer_key = (sandbox_id, proc_id)
                    if buffer_key in self.storage.log_buffers:
                        del self.storage.log_buffers[buffer_key]
                        self.logger.debug(f"Cleaned up log buffer for {buffer_key}")

            # Terminate the sandbox
            try:
                if hasattr(sb, "terminate"):
                    sb.terminate()
                elif hasattr(sb, "close"):
                    sb.close()
            except Exception as e:
                self.logger.warning(f"Could not terminate sandbox: {str(e)}")

            # Clean up from memory
            if sandbox_id in self.storage.sandboxes:
                del self.storage.sandboxes[sandbox_id]
            if sandbox_id in self.storage.processes:
                del self.storage.processes[sandbox_id]

            # wipe temp prompt files (best-effort)
            try:
                sb.exec("rm", "-f", "/home/swarm/tmp/*.txt").wait()
            except Exception:
                pass

            self.logger.info(f"Terminated sandbox {sandbox_id}")

        except Exception as e:
            self.logger.error(f"Failed to terminate sandbox: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to terminate sandbox: {str(e)}"
            )
    
    def get(self, sandbox_id: str) -> modal.Sandbox:
        """Get sandbox by ID from memory."""
        if sandbox_id in self.storage.sandboxes:
            return self.storage.sandboxes[sandbox_id]
        raise SandboxNotFoundError(f"Sandbox {sandbox_id} not found")
    
    def status(self, sandbox_id: str) -> SandboxStatusResp:
        """Get the status of a sandbox."""
        try:
            sb = self.get(sandbox_id)
            # For now, assume running if we can get the sandbox
            # In a real implementation, you'd check Modal's status API
            return SandboxStatusResp(status="running")
        except SandboxNotFoundError:
            # If sandbox not found, assume it's stopped
            return SandboxStatusResp(status="stopped")
        except Exception as e:
            self.logger.error(f"Failed to get sandbox status: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to get sandbox status: {str(e)}"
            )
    
    def _clone_repository(self, sb: modal.Sandbox, req: CreateSandboxReq, sandbox_id: str):
        """Clone repository with error handling."""
        try:
            # Use authenticated URL if GitHub token is provided
            clone_url = req.repo_url
            if req.github_token and "github.com" in req.repo_url:
                # Convert https://github.com/user/repo to https://token@github.com/user/repo
                clone_url = req.repo_url.replace(
                    "https://github.com",
                    f"https://x-access-token:{req.github_token}@github.com",
                )
                self.logger.info(f"Using authenticated clone for {req.repo_url}")
            else:
                self.logger.info(f"Using public clone for {req.repo_url}")

            # Extract repo name from URL for folder name
            repo_name = req.repo_url.rstrip("/").split("/")[-1]
            if repo_name.endswith(".git"):
                repo_name = repo_name[:-4]

            self.logger.info(
                f"Cloning {req.repo_url} branch {req.branch} to /home/swarm/{repo_name}"
            )
            # Run git clone as swarm user
            clone_proc = sb.exec(
                "su",
                "-",
                "swarm",
                "-c",
                f"git clone {clone_url} /home/swarm/{repo_name} -b {req.branch}",
            )

            # Wait for clone to complete and get result
            clone_exit_code = clone_proc.wait()
            self.logger.info(f"Git clone exit code: {clone_exit_code}")

            if clone_exit_code == 0:
                self.logger.info("Git clone succeeded")
            else:
                self.logger.error(f"Git clone failed with exit code {clone_exit_code}")
                # Try to get error output
                try:
                    if hasattr(clone_proc, "stderr") and clone_proc.stderr:
                        stderr = (
                            clone_proc.stderr.read()
                            if hasattr(clone_proc.stderr, "read")
                            else str(clone_proc.stderr)
                        )
                        self.logger.error(f"Git clone error: {stderr}")
                except Exception as error_output:
                    self.logger.warning(f"Could not read git clone error: {error_output}")

                # Try basic clone without branch specification as fallback
                try:
                    self.logger.info(f"Retrying clone without branch specification")
                    fallback_proc = sb.exec(
                        "su",
                        "-",
                        "swarm",
                        "-c",
                        f"git clone {clone_url} /home/swarm/{repo_name}",
                    )
                    fallback_exit_code = fallback_proc.wait()
                    self.logger.info(f"Fallback git clone exit code: {fallback_exit_code}")
                except Exception as fallback_error:
                    self.logger.error(f"Fallback git clone also failed: {fallback_error}")

        except Exception as setup_error:
            self.logger.error(f"Git clone exception: {setup_error}")
            # Don't fail sandbox creation - let the exec commands handle it later
    
    def _configure_git(self, sb: modal.Sandbox, req: CreateSandboxReq):
        """Configure git user settings during startup."""
        try:
            self.logger.info("Configuring git user settings during startup")

            # Configure git user.name
            git_name_proc = sb.exec(
                "su",
                "-",
                "swarm",
                "-c",
                f"git config --global user.name '{req.author_name}'",
            )
            git_name_exit = git_name_proc.wait()
            self.logger.info(f"Git user.name config exit code: {git_name_exit}")

            # Configure git user.email
            git_email_proc = sb.exec(
                "su",
                "-",
                "swarm",
                "-c",
                f"git config --global user.email '{req.author_email}'",
            )
            git_email_exit = git_email_proc.wait()
            self.logger.info(f"Git user.email config exit code: {git_email_exit}")

            # Configure authenticated remote if GitHub token and repo were cloned successfully
            if req.github_token and req.repo_url:
                try:
                    # Extract repo name and full name from URL
                    repo_name = req.repo_url.rstrip("/").split("/")[-1]
                    if repo_name.endswith(".git"):
                        repo_name = repo_name[:-4]
                    
                    repo_full_name = req.repo_url.replace(
                        "https://github.com/", ""
                    ).replace(".git", "")

                    self.logger.info(
                        f"Configuring authenticated git remote for {repo_full_name}"
                    )
                    remote_config_cmd = f"""
                    cd /home/swarm/{repo_name} &&
                    if [ -d .git ]; then
                        if git remote | grep -q "^origin$"; then
                            echo "Updating existing origin remote" &&
                            git remote set-url origin "https://x-access-token:{req.github_token}@github.com/{repo_full_name}";
                        else
                            echo "Adding new origin remote" &&
                            git remote add origin "https://x-access-token:{req.github_token}@github.com/{repo_full_name}";
                        fi;
                        git remote -v;
                    else
                        echo "No git repository found, skipping remote config";
                    fi
                    """

                    remote_proc = sb.exec(
                        "su", "-", "swarm", "-c", remote_config_cmd
                    )
                    remote_exit = remote_proc.wait()
                    self.logger.info(f"Git remote config exit code: {remote_exit}")

                except Exception as remote_error:
                    self.logger.warning(
                        f"Failed to configure git remote: {remote_error}"
                    )

            self.logger.info("Successfully configured git settings during startup")

        except Exception as git_config_error:
            self.logger.warning(
                f"Failed to configure git during startup: {git_config_error}"
            )
            # Don't fail sandbox creation - this is not critical
    
    def _setup_dev_tools(self, sb: modal.Sandbox, req: CreateSandboxReq):
        """Setup development tools like pre-commit hooks."""
        try:
            # Extract repo name from URL for folder name
            repo_name = req.repo_url.rstrip("/").split("/")[-1]
            if repo_name.endswith(".git"):
                repo_name = repo_name[:-4]
                
            setup_script_path = f"/home/swarm/{repo_name}/scripts/setup.sh"
            
            # Run the setup script to install pre-commit hooks
            setup_proc = sb.exec(
                "su", "-", "swarm", "-c", f"cd /home/swarm/{repo_name} && chmod +x {setup_script_path} && {setup_script_path}"
            )
            
            setup_exit_code = setup_proc.wait()
            if setup_exit_code == 0:
                self.logger.info("Development tools setup completed successfully")
            else:
                self.logger.warning(f"Development tools setup failed with exit code {setup_exit_code}")
                
        except Exception as setup_error:
            self.logger.warning(f"Failed to setup development tools: {setup_error}")
            # Don't fail sandbox creation - this is not critical
    
    def _bootstrap_postgres(self, sb: modal.Sandbox, req: CreateSandboxReq):
        """Run postgres bootstrap script."""
        # Extract repo name from URL for folder name
        repo_name = req.repo_url.rstrip("/").split("/")[-1]
        if repo_name.endswith(".git"):
            repo_name = repo_name[:-4]
            
        script_path = (
            f"/home/swarm/{repo_name}/backend/scripts/start_postgres_and_migrate.sh"
        )

        pg_proc = sb.exec(
            "su", "-", "swarm", "-c", f"chmod +x {script_path} && {script_path}"
        )

        # Wait for postgres setup to complete and get result
        pg_exit_code = pg_proc.wait()
        self.logger.info(f"Postgres setup exit code: {pg_exit_code}")

        if pg_exit_code == 0:
            self.logger.info("Postgres setup succeeded")
        else:
            self.logger.error(f"Postgres setup failed with exit code {pg_exit_code}")
            # Try to get both stdout and stderr output
            try:
                if hasattr(pg_proc, "stdout") and pg_proc.stdout:
                    stdout = (
                        pg_proc.stdout.read()
                        if hasattr(pg_proc.stdout, "read")
                        else str(pg_proc.stdout)
                    )
                    self.logger.info(f"Postgres setup stdout: {stdout}")
                if hasattr(pg_proc, "stderr") and pg_proc.stderr:
                    stderr = (
                        pg_proc.stderr.read()
                        if hasattr(pg_proc.stderr, "read")
                        else str(pg_proc.stderr)
                    )
                    self.logger.error(f"Postgres setup stderr: {stderr}")
            except Exception as error_output:
                self.logger.warning(f"Could not read postgres setup output: {error_output}")

            raise HTTPException(
                status_code=500,
                detail=f"Postgres bootstrap failed (exit {pg_exit_code})",
            )