#!/usr/bin/env python3

import modal
import uuid
import time
import logging
import threading
import shlex
import textwrap
import base64
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from collections import defaultdict, deque
from modal.stream_type import StreamType
from modal_image import image as swarm_dev_img

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Modal app for sandbox management
app_modal = modal.App.lookup("sandbox-shim", create_if_missing=True)

# In-memory storage for sandboxes and processes
SANDBOXES: Dict[str, modal.Sandbox] = {}
PROCS: Dict[str, Dict[str, Any]] = {}

# Global buffer store for non-blocking log retrieval
LOG_BUFFERS = defaultdict(lambda: {"stdout": deque(), "stderr": deque()})

# Request/Response models
class CreateSandboxReq(BaseModel):
    repo_url: str
    branch: str = "main"
    region: Optional[str] = None
    github_token: Optional[str] = None
    author_name: Optional[str] = None
    author_email: Optional[str] = None

class CreateSandboxResp(BaseModel):
    sandbox_id: str
    hostname: str

class ExecReq(BaseModel):
    cmd: List[str]
    cwd: Optional[str] = None

class ExecResp(BaseModel):
    proc_id: str

class ExitCodeResp(BaseModel):
    code: Optional[int]

class LogsResp(BaseModel):
    stdout: str
    stderr: str

class SandboxStatusResp(BaseModel):
    status: str  # "starting", "running", "stopped", "failed"

class WorkflowReq(BaseModel):
    repo_url: Optional[str] = None
    branch: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None

class ClaudeCodeExecReq(BaseModel):
    repo_path: str
    prompt: str
    task_id: int
    github_token: str
    anthropic_api_key: str
    openai_api_key: Optional[str] = None
    branch: str
    author_name: str
    author_email: str

class PushChangesReq(BaseModel):
    repo_path: str
    branch: str
    task_id: int
    author_name: str
    author_email: str
    commit_title: str
    commit_body: str

# FastAPI app
app = FastAPI(title="Modal Sandbox Shim", version="1.0.0")

def get_sb(sandbox_id: str) -> modal.Sandbox:
    """Get sandbox by ID from memory."""
    if sandbox_id in SANDBOXES:
        return SANDBOXES[sandbox_id]
    raise HTTPException(status_code=404, detail=f"Sandbox {sandbox_id} not found")

def _tail_process_output(proc, key):
    """Consume process output in background threads using Modal's streaming."""
    # Create events to signal when each stream is fully consumed
    stdout_complete = threading.Event()
    stderr_complete = threading.Event()

    def consume_stdout():
        try:
            for line in proc.stdout:
                LOG_BUFFERS[key]["stdout"].append(line)
                # Print all stdout lines in real-time
                logger.info(f"[{key[0][:8]}:{key[1][:8]}] STDOUT: {line.rstrip()}")
            # Signal completion when iterator is exhausted
            stdout_complete.set()
            logger.debug(f"Stdout consumption complete for {key}")
        except Exception as e:
            logger.warning(f"Error reading stdout for {key}: {str(e)}")
            stdout_complete.set()  # Signal even on error

    def consume_stderr():
        try:
            for line in proc.stderr:
                LOG_BUFFERS[key]["stderr"].append(line)
                # Print all stderr lines in real-time
                logger.error(f"[{key[0][:8]}:{key[1][:8]}] STDERR: {line.rstrip()}")
            # Signal completion when iterator is exhausted
            stderr_complete.set()
            logger.debug(f"Stderr consumption complete for {key}")
        except Exception as e:
            logger.warning(f"Error reading stderr for {key}: {str(e)}")
            stderr_complete.set()  # Signal even on error

    # Start background threads to consume streams
    stdout_thread = threading.Thread(target=consume_stdout, daemon=True)
    stderr_thread = threading.Thread(target=consume_stderr, daemon=True)

    stdout_thread.start()
    stderr_thread.start()

    logger.debug(f"Started background streaming for process {key}")

    # Return completion events so caller can wait for them
    return stdout_complete, stderr_complete

def _cleanup_process_logs(sandbox_id, proc_id):
    """Clean up log buffers for a completed process."""
    buffer_key = (sandbox_id, proc_id)
    if buffer_key in LOG_BUFFERS:
        del LOG_BUFFERS[buffer_key]
        logger.debug(f"Cleaned up log buffer for {buffer_key}")

@app.post("/sandboxes", response_model=CreateSandboxResp)
async def create_sandbox(req: CreateSandboxReq):
    """Create a new sandbox and clone the repository."""
    try:
        # Create unique sandbox ID
        sandbox_id = str(uuid.uuid4())

        # Create Modal sandbox using pre-built image with all tools installed
        sb = modal.Sandbox.create(
            image=swarm_dev_img,
            workdir="/home/swarm",
            timeout=3600,  # 1 hour timeout
            app=app_modal,
            verbose=True,
        )

        # Store in memory
        SANDBOXES[sandbox_id] = sb
        PROCS[sandbox_id] = {}

        # swarm user is already created in the pre-built image
        logger.info("Using pre-built image with swarm user already configured")

        # Clone repository (git is already installed via image)
        try:
            # Use authenticated URL if GitHub token is provided
            clone_url = req.repo_url
            if req.github_token and "github.com" in req.repo_url:
                # Convert https://github.com/user/repo to https://token@github.com/user/repo
                clone_url = req.repo_url.replace("https://github.com", f"https://x-access-token:{req.github_token}@github.com")
                logger.info(f"Using authenticated clone for {req.repo_url}")
            else:
                logger.info(f"Using public clone for {req.repo_url}")

            # Extract repo name from URL for folder name
            repo_name = req.repo_url.rstrip('/').split('/')[-1]
            if repo_name.endswith('.git'):
                repo_name = repo_name[:-4]

            logger.info(f"Cloning {req.repo_url} branch {req.branch} to /home/swarm/{repo_name}")
            # Run git clone as swarm user
            clone_proc = sb.exec("su", "-", "swarm", "-c", f"git clone {clone_url} /home/swarm/{repo_name} -b {req.branch}")

            # Wait for clone to complete and get result
            clone_exit_code = clone_proc.wait()
            logger.info(f"Git clone exit code: {clone_exit_code}")

            if clone_exit_code == 0:
                logger.info("Git clone succeeded")
            else:
                logger.error(f"Git clone failed with exit code {clone_exit_code}")
                # Try to get error output
                try:
                    if hasattr(clone_proc, 'stderr') and clone_proc.stderr:
                        stderr = clone_proc.stderr.read() if hasattr(clone_proc.stderr, 'read') else str(clone_proc.stderr)
                        logger.error(f"Git clone error: {stderr}")
                except Exception as error_output:
                    logger.warning(f"Could not read git clone error: {error_output}")

                # Try basic clone without branch specification as fallback
                try:
                    logger.info(f"Retrying clone without branch specification")
                    fallback_proc = sb.exec("su", "-", "swarm", "-c", f"git clone {clone_url} /home/swarm/{repo_name}")
                    fallback_exit_code = fallback_proc.wait()
                    logger.info(f"Fallback git clone exit code: {fallback_exit_code}")
                except Exception as fallback_error:
                    logger.error(f"Fallback git clone also failed: {fallback_error}")

        except Exception as setup_error:
            logger.error(f"Git clone exception: {setup_error}")
            # Don't fail sandbox creation - let the exec commands handle it later

        # Configure git user settings during startup if provided
        if req.author_name and req.author_email:
            try:
                logger.info("Configuring git user settings during startup")

                # Configure git user.name
                git_name_proc = sb.exec("su", "-", "swarm", "-c", f"git config --global user.name '{req.author_name}'")
                git_name_exit = git_name_proc.wait()
                logger.info(f"Git user.name config exit code: {git_name_exit}")

                # Configure git user.email
                git_email_proc = sb.exec("su", "-", "swarm", "-c", f"git config --global user.email '{req.author_email}'")
                git_email_exit = git_email_proc.wait()
                logger.info(f"Git user.email config exit code: {git_email_exit}")

                # Configure authenticated remote if GitHub token and repo were cloned successfully
                if req.github_token and repo_name:
                    try:
                        # Extract repo full name from URL (e.g., "jmvldz/swarm")
                        repo_full_name = req.repo_url.replace("https://github.com/", "").replace(".git", "")

                        logger.info(f"Configuring authenticated git remote for {repo_full_name}")
                        remote_config_cmd = f'''
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
                        '''

                        remote_proc = sb.exec("su", "-", "swarm", "-c", remote_config_cmd)
                        remote_exit = remote_proc.wait()
                        logger.info(f"Git remote config exit code: {remote_exit}")

                    except Exception as remote_error:
                        logger.warning(f"Failed to configure git remote: {remote_error}")

                logger.info("Successfully configured git settings during startup")

            except Exception as git_config_error:
                logger.warning(f"Failed to configure git during startup: {git_config_error}")
                # Don't fail sandbox creation - this is not critical
        else:
            logger.info("No git author info provided, skipping git configuration")

        logger.info(f"Created sandbox {sandbox_id} with repo {req.repo_url}")

        return CreateSandboxResp(
            sandbox_id=sandbox_id,
            hostname=f"sandbox-{sandbox_id}"
        )
    except Exception as e:
        logger.error(f"Failed to create sandbox: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create sandbox: {str(e)}")

@app.post("/sandboxes/{sandbox_id}/exec", response_model=ExecResp)
async def exec_command(sandbox_id: str, req: ExecReq):
    """Execute a command in the sandbox."""
    try:
        sb = get_sb(sandbox_id)
        proc_id = str(uuid.uuid4())

        # Build command with working directory
        cmd_parts = req.cmd
        workdir = req.cwd or "/home/swarm"

        # Execute command as swarm user using Modal's exec method
        # Build the command to run as swarm user
        cmd_str = ' '.join(f"'{part}'" for part in cmd_parts)

        logger.info(f"Executing command in sandbox {sandbox_id}: {' '.join(req.cmd)} (cwd: {workdir})")

        proc = sb.exec(
            "su", "-", "swarm", "-c", f"cd {workdir} && {cmd_str}",
            stdout=StreamType.PIPE,
            stderr=StreamType.PIPE
        )

        # Create buffer key and start background thread to consume output
        buffer_key = (sandbox_id, proc_id)
        stdout_complete, stderr_complete = _tail_process_output(proc, buffer_key)

        # Store the actual ContainerProcess object and completion events
        PROCS[sandbox_id][proc_id] = {
            "proc": proc,
            "buffer_key": buffer_key,
            "stdout_complete": stdout_complete,
            "stderr_complete": stderr_complete,
            "output_fully_consumed": False
        }

        # Check for immediate command failure
        time.sleep(0.1)  # Brief pause to allow immediate failures to be detected
        exit_code = proc.poll()
        if exit_code is not None:
            logger.error(f"Command failed immediately with exit code {exit_code}: {' '.join(req.cmd)}")
            # Give a moment for any error output to be captured
            time.sleep(0.5)
            # Log any captured stderr immediately
            current_stderr = "".join(LOG_BUFFERS[buffer_key]["stderr"])
            if current_stderr.strip():
                logger.error(f"Immediate command failure stderr: {current_stderr.strip()}")

        logger.info(f"Command started in sandbox {sandbox_id} with proc_id {proc_id}")
        return ExecResp(proc_id=proc_id)

    except Exception as e:
        logger.error(f"Failed to execute command: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to execute command: {str(e)}")

@app.get("/sandboxes/{sandbox_id}/procs/{proc_id}/exit_code", response_model=ExitCodeResp)
async def get_exit_code(sandbox_id: str, proc_id: str):
    """Get the exit code of a process, ensuring all output is consumed first."""
    try:
        if sandbox_id not in PROCS or proc_id not in PROCS[sandbox_id]:
            raise HTTPException(status_code=404, detail="Process not found")

        proc_info = PROCS[sandbox_id][proc_id]
        proc = proc_info["proc"] if isinstance(proc_info, dict) else proc_info

        # Use Modal's poll method - returns exit code if finished, None if running
        exit_code = proc.poll()

        if exit_code is None:
            # Process still running - return None immediately (no blocking)
            return ExitCodeResp(code=None)

        # Log process completion
        logger.info(f"Process {proc_id} completed with exit code {exit_code}")

        # Process has finished - ensure all output is consumed before returning exit code
        if not proc_info.get("output_fully_consumed", False):
            logger.info(f"Process {proc_id} finished with exit code {exit_code}, waiting for output consumption...")

            # Get completion events
            stdout_complete = proc_info.get("stdout_complete")
            stderr_complete = proc_info.get("stderr_complete")

            if stdout_complete and stderr_complete:
                # Wait for both streams to be fully consumed (with timeout)
                stdout_ready = stdout_complete.wait(timeout=10.0)  # 10 second timeout
                stderr_ready = stderr_complete.wait(timeout=10.0)

                if stdout_ready and stderr_ready:
                    logger.info(f"All output consumed for process {proc_id}")
                else:
                    logger.warning(f"Timeout waiting for output consumption for process {proc_id}")
                    # Try to get any remaining output with communicate as fallback
                    try:
                        remaining_stdout, remaining_stderr = proc.communicate(timeout=5.0)
                        if remaining_stdout:
                            LOG_BUFFERS[proc_info["buffer_key"]]["stdout"].extend(remaining_stdout.splitlines(True))
                        if remaining_stderr:
                            LOG_BUFFERS[proc_info["buffer_key"]]["stderr"].extend(remaining_stderr.splitlines(True))
                        logger.info(f"Fallback communicate() captured remaining output for process {proc_id}")
                    except Exception as comm_error:
                        logger.warning(f"Fallback communicate() failed for process {proc_id}: {str(comm_error)}")
                        # Best effort - continue anyway
            else:
                # No completion events (older process or different execution path)
                logger.info(f"No completion events for process {proc_id}, assuming output consumed")

            # Mark as fully consumed
            proc_info["output_fully_consumed"] = True

        return ExitCodeResp(code=exit_code)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get exit code: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get exit code: {str(e)}")

@app.get("/sandboxes/{sandbox_id}/procs/{proc_id}/logs", response_model=LogsResp)
async def get_logs(sandbox_id: str, proc_id: str, since: int = 0):
    """Get logs from a process starting from a specific offset."""
    try:
        if sandbox_id not in PROCS or proc_id not in PROCS[sandbox_id]:
            raise HTTPException(status_code=404, detail="Process not found")

        buffer_key = (sandbox_id, proc_id)
        buffer = LOG_BUFFERS[buffer_key]

        # Get current buffer contents
        stdout_lines = list(buffer["stdout"])
        stderr_lines = list(buffer["stderr"])

        # Apply since offset (character-based for backward compatibility)
        stdout = "".join(stdout_lines)
        stderr = "".join(stderr_lines)

        if since > 0:
            stdout = stdout[since:] if len(stdout) > since else ""
            stderr = stderr[since:] if len(stderr) > since else ""

        return LogsResp(stdout=stdout, stderr=stderr)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get logs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get logs: {str(e)}")

@app.get("/sandboxes/{sandbox_id}/procs/{proc_id}/logs_once", response_model=LogsResp)
async def get_logs_once(sandbox_id: str, proc_id: str):
    """Get current buffer contents immediately without blocking."""
    try:
        if sandbox_id not in PROCS or proc_id not in PROCS[sandbox_id]:
            raise HTTPException(status_code=404, detail="Process not found")

        buffer_key = (sandbox_id, proc_id)
        buffer = LOG_BUFFERS[buffer_key]

        # Return current buffer contents immediately
        stdout = "".join(buffer["stdout"])
        stderr = "".join(buffer["stderr"])

        return LogsResp(stdout=stdout, stderr=stderr)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get logs once: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get logs once: {str(e)}")

@app.delete("/sandboxes/{sandbox_id}")
async def terminate_sandbox(sandbox_id: str):
    """Terminate a sandbox."""
    try:
        sb = get_sb(sandbox_id)

        # Kill all processes first and clean up logs
        if sandbox_id in PROCS:
            for proc_id, proc_info in PROCS[sandbox_id].items():
                try:
                    proc = proc_info["proc"] if isinstance(proc_info, dict) else proc_info
                    if hasattr(proc, 'terminate'):
                        proc.terminate()
                    elif hasattr(proc, 'kill'):
                        proc.kill()
                except Exception as e:
                    logger.warning(f"Could not terminate process {proc_id}: {str(e)}")

                # Clean up log buffer for this process
                _cleanup_process_logs(sandbox_id, proc_id)

        # Terminate the sandbox
        try:
            if hasattr(sb, 'terminate'):
                sb.terminate()
            elif hasattr(sb, 'close'):
                sb.close()
        except Exception as e:
            logger.warning(f"Could not terminate sandbox: {str(e)}")

        # Clean up from memory
        if sandbox_id in SANDBOXES:
            del SANDBOXES[sandbox_id]
        if sandbox_id in PROCS:
            del PROCS[sandbox_id]

        # wipe temp prompt files (best-effort)
        sb.exec("rm", "-f", "/home/swarm/tmp/*.txt").wait()

        logger.info(f"Terminated sandbox {sandbox_id}")
        return {"message": "Sandbox terminated"}

    except Exception as e:
        logger.error(f"Failed to terminate sandbox: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to terminate sandbox: {str(e)}")

@app.get("/sandboxes/{sandbox_id}", response_model=SandboxStatusResp)
async def get_sandbox_status(sandbox_id: str):
    """Get the status of a sandbox."""
    try:
        sb = get_sb(sandbox_id)

        # For now, assume running if we can get the sandbox
        # In a real implementation, you'd check Modal's status API
        return SandboxStatusResp(status="running")

    except HTTPException:
        # If sandbox not found, assume it's stopped
        return SandboxStatusResp(status="stopped")
    except Exception as e:
        logger.error(f"Failed to get sandbox status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get sandbox status: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "sandboxes": len(SANDBOXES),
        "processes": sum(len(procs) for procs in PROCS.values())
    }

# Workflow helper endpoints
@app.post("/sandboxes/{sandbox_id}/clone_repo", response_model=ExecResp)
async def clone_repo(sandbox_id: str, req: WorkflowReq):
    """Clone a repository to the sandbox."""
    if not req.repo_url:
        raise HTTPException(status_code=400, detail="repo_url is required")

    # Extract repo name from URL for folder name
    repo_name = req.repo_url.rstrip('/').split('/')[-1]
    if repo_name.endswith('.git'):
        repo_name = repo_name[:-4]

    # Commands are now automatically run as swarm user via exec_command
    exec_req = ExecReq(
        cmd=["git", "clone", req.repo_url, f"/home/swarm/{repo_name}", "-b", req.branch or "main"],
        cwd="/home/swarm"
    )
    return await exec_command(sandbox_id, exec_req)

@app.post("/sandboxes/{sandbox_id}/install_tools", response_model=ExecResp)
async def install_tools(sandbox_id: str):
    """Verify that development tools are available (already installed in pre-built image)."""
    # Tools are already installed in the pre-built image, just verify availability
    exec_req = ExecReq(
        cmd=["bash", "-c", "which claude && which cargo && which bun && which node && echo 'All tools available'"],
        cwd="/home/swarm"
    )
    return await exec_command(sandbox_id, exec_req)

@app.post("/sandboxes/{sandbox_id}/configure_git", response_model=ExecResp)
async def configure_git(sandbox_id: str, req: WorkflowReq):
    """Configure Git user settings."""
    if not req.user_name or not req.user_email:
        raise HTTPException(status_code=400, detail="user_name and user_email are required")

    # Commands are now automatically run as swarm user via exec_command
    exec_req = ExecReq(
        cmd=["bash", "-c", f"git config --global user.name '{req.user_name}' && git config --global user.email '{req.user_email}'"],
        cwd="/home/swarm"  # Git config is global, so any directory works
    )
    return await exec_command(sandbox_id, exec_req)

@app.post("/sandboxes/{sandbox_id}/push_changes", response_model=ExecResp)
async def push_changes(sandbox_id: str, req: WorkflowReq):
    """Push changes to the repository."""
    branch = req.branch or "main"
    # Note: This endpoint would need repo URL to determine the correct folder
    # For now, assume the repo is in the working directory
    exec_req = ExecReq(
        cmd=["bash", "-c", f"git add . && git commit -m 'Auto-commit changes' && git push origin {branch}"],
        cwd="/home/swarm"  # This would need to be updated to use the actual repo folder
    )
    return await exec_command(sandbox_id, exec_req)

# New Claude Code specific endpoints
@app.post("/sandboxes/{sandbox_id}/install_claude_code", response_model=ExecResp)
async def install_claude_code(sandbox_id: str):
    """Verify Claude Code is available (already installed in pre-built image)."""
    try:
        logger.info(f"Verifying Claude Code in sandbox {sandbox_id}")

        # Claude Code is already installed in the pre-built image, just verify
        verify_cmd = '''
            export PATH="$HOME/.local/bin:$PATH" && \
            which claude && \
            claude --version
        '''

        exec_req = ExecReq(
            cmd=["bash", "-c", verify_cmd],
            cwd="/home/swarm"
        )

        return await exec_command(sandbox_id, exec_req)

    except Exception as e:
        logger.error(f"Failed to verify Claude Code: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to verify Claude Code: {str(e)}")

@app.post("/sandboxes/{sandbox_id}/exec_claude_code", response_model=ExecResp)
async def exec_claude_code(sandbox_id: str, req: ClaudeCodeExecReq):
    """
    ▸ New flow:
      1.  Create Claude prompt with artifact markers
      2.  Write prompt to /home/swarm/tmp/<uuid>.txt
      3.  Launch claude reading < prompt.txt
    """
    sb = get_sb(sandbox_id)

    # -------- 1.  Create the Claude prompt with artifact markers ------------
    claude_prompt = f"""Please work on this task {req.task_id}: {req.prompt}.

After completing the task, you MUST output the following markers in this exact format:

COMMIT_MESSAGE_TITLE: Your commit title here
COMMIT_MESSAGE_BODY: Your detailed commit message body here
PR_TITLE: Your pull request title here
PR_BODY: Your detailed pull request description here
DONE

The system requires these markers to automatically generate commit messages and pull requests. Without them, the task will fail."""

    # -------- 2.  write prompt file -----------------------------------------
    prompt_id   = str(uuid.uuid4())
    prompt_dir  = "/home/swarm/tmp"
    prompt_path = f"{prompt_dir}/{prompt_id}.txt"

    # make sure tmp dir exists (idempotent, fast)
    sb.exec("mkdir", "-p", prompt_dir).wait()

    b64_prompt = base64.b64encode(claude_prompt.encode()).decode()
    write_cmd = f"echo {shlex.quote(b64_prompt)} | base64 -d > {shlex.quote(prompt_path)}"
    write_result = sb.exec("bash", "-c", write_cmd).wait()
    if write_result == 0:
        logger.info("Prompt written successfully to %s", prompt_path)
    else:
        logger.error("Failed to write prompt to %s (exit code: %d)", prompt_path, write_result)

    # -------- 3.  build environment -----------------------------------------
    env_pairs = {
        "GITHUB_TOKEN":       req.github_token,
        "ANTHROPIC_API_KEY":  req.anthropic_api_key,
        "SWARM_TASK_ID":      str(req.task_id),
        "SWARM_BRANCH":       req.branch,
        "GIT_AUTHOR_NAME":    req.author_name,
        "GIT_AUTHOR_EMAIL":   req.author_email,
    }
    if req.openai_api_key:
        env_pairs["OPENAI_API_KEY"] = req.openai_api_key

    env_setup = " && ".join(
        f"export {k}={shlex.quote(v)}" for k, v in env_pairs.items()
    )

    # -------- 4.  craft final command ---------------------------------------
    shell_script = textwrap.dedent(f"""
        {env_setup}
        export PATH="/home/swarm/.local/bin:/home/swarm/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games"
        cd {shlex.quote(req.repo_path)}
        cat {shlex.quote(prompt_path)} | claude -p --dangerously-skip-permissions --verbose --output-format stream-json
    """)

    logger.info(f"Executing Claude Code for task {req.task_id} in repo {req.repo_path}")
    logger.debug(f"Claude Code shell script:\n{shell_script}")

    exec_req = ExecReq(
        cmd=["bash", "-c", shell_script],
        cwd=req.repo_path          # still needed for container
    )
    return await exec_command(sandbox_id, exec_req)

@app.post("/sandboxes/{sandbox_id}/push_changes_advanced", response_model=ExecResp)
async def push_changes_advanced(sandbox_id: str, req: PushChangesReq):
    """Push changes to GitHub branch with proper commit information."""
    try:
        logger.info(f"Pushing changes to branch {req.branch} in sandbox {sandbox_id}")

        sb = get_sb(sandbox_id)

        # Step 1: Change to repository directory
        logger.info(f"Step 1: Changing to repository directory {req.repo_path}")
        cd_proc = sb.exec("su", "-", "swarm", "-c", f"cd {req.repo_path} && pwd")
        cd_exit_code = cd_proc.wait()
        logger.info(f"Directory change exit code: {cd_exit_code}")

        if cd_exit_code != 0:
            raise HTTPException(status_code=500, detail=f"Failed to change to directory {req.repo_path}")

        # Step 2: Stage all changes
        logger.info("Step 2: Staging all changes")
        add_proc = sb.exec("su", "-", "swarm", "-c", f"cd {req.repo_path} && git add -A")
        add_exit_code = add_proc.wait()
        logger.info(f"Git add exit code: {add_exit_code}")

        if add_exit_code != 0:
            raise HTTPException(status_code=500, detail="Failed to stage changes")

        # Step 3: Write commit message to temporary file
        logger.info("Step 3: Writing commit message to temporary file")
        commit_msg_content = f"{req.commit_title}\n\n{req.commit_body}"
        write_msg_proc = sb.exec("su", "-", "swarm", "-c", f"cd {req.repo_path} && cat > /tmp/commit_message_{req.task_id} << 'EOF'\n{commit_msg_content}\nEOF")
        write_msg_exit_code = write_msg_proc.wait()
        logger.info(f"Commit message write exit code: {write_msg_exit_code}")

        if write_msg_exit_code != 0:
            raise HTTPException(status_code=500, detail="Failed to write commit message")

        # Step 4: Commit changes to current branch
        logger.info("Step 4: Committing changes to current branch")
        commit_proc = sb.exec("su", "-", "swarm", "-c", f"cd {req.repo_path} && git commit -F /tmp/commit_message_{req.task_id}")
        commit_exit_code = commit_proc.wait()
        logger.info(f"Git commit exit code: {commit_exit_code}")

        if commit_exit_code != 0:
            raise HTTPException(status_code=500, detail="Failed to commit changes")

        # Step 5: Create new branch from the commit
        logger.info(f"Step 5: Creating new branch {req.branch}")
        branch_proc = sb.exec("su", "-", "swarm", "-c", f"cd {req.repo_path} && git checkout -B {req.branch}")
        branch_exit_code = branch_proc.wait()
        logger.info(f"Git branch creation exit code: {branch_exit_code}")

        if branch_exit_code != 0:
            raise HTTPException(status_code=500, detail=f"Failed to create branch {req.branch}")

        # Step 6: Push the branch to origin
        logger.info(f"Step 6: Pushing branch {req.branch} to origin")
        push_proc = sb.exec("su", "-", "swarm", "-c", f"cd {req.repo_path} && git push -u origin {req.branch}")
        push_exit_code = push_proc.wait()
        logger.info(f"Git push exit code: {push_exit_code}")

        if push_exit_code != 0:
            raise HTTPException(status_code=500, detail=f"Failed to push branch {req.branch}")

        # Step 7: Clean up temporary commit message file
        logger.info("Step 7: Cleaning up temporary files")
        cleanup_proc = sb.exec("su", "-", "swarm", "-c", f"rm -f /tmp/commit_message_{req.task_id}")
        cleanup_exit_code = cleanup_proc.wait()
        logger.info(f"Cleanup exit code: {cleanup_exit_code}")

        # Don't fail if cleanup fails, just log a warning
        if cleanup_exit_code != 0:
            logger.warning(f"Failed to cleanup temporary file, but continuing")

        logger.info(f"Successfully pushed changes to branch {req.branch}")

        # Return a dummy process ID since we executed multiple commands
        return ExecResp(proc_id="push_changes_completed")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to push changes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to push changes: {str(e)}")


# Legacy endpoint for backward compatibility
@app.post("/create_sandbox", response_model=CreateSandboxResp)
async def create_sandbox_legacy(req: CreateSandboxReq):
    """Legacy endpoint for backward compatibility."""
    return await create_sandbox(req)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
