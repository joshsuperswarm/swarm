#!/usr/bin/env python3

import modal
import uuid
import time
import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Modal app for sandbox management
app_modal = modal.App.lookup("sandbox-shim", create_if_missing=True)

# In-memory storage for sandboxes and processes
SANDBOXES: Dict[str, modal.Sandbox] = {}
PROCS: Dict[str, Dict[str, Any]] = {}

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

# FastAPI app
app = FastAPI(title="Modal Sandbox Shim", version="1.0.0")

def get_sb(sandbox_id: str) -> modal.Sandbox:
    """Get sandbox by ID from memory."""
    if sandbox_id in SANDBOXES:
        return SANDBOXES[sandbox_id]
    raise HTTPException(status_code=404, detail=f"Sandbox {sandbox_id} not found")

@app.post("/sandboxes", response_model=CreateSandboxResp)
async def create_sandbox(req: CreateSandboxReq):
    """Create a new sandbox and clone the repository."""
    try:
        # Create unique sandbox ID
        sandbox_id = str(uuid.uuid4())
        
        # Create Modal sandbox with proper image specification
        image = modal.Image.debian_slim().pip_install("requests").apt_install("git", "curl", "build-essential", "sudo")
        
        sb = modal.Sandbox.create(
            image=image,
            workdir="/home/swarm",
            timeout=3600,  # 1 hour timeout
            app=app_modal,
        )
        
        # Store in memory
        SANDBOXES[sandbox_id] = sb
        PROCS[sandbox_id] = {}
        
        # Create non-root user 'swarm' for running Claude Code
        try:
            logger.info("Creating swarm user for non-root operations")
            
            # Create the swarm user with home directory
            user_create_proc = sb.exec("useradd", "-m", "-s", "/bin/bash", "swarm")
            user_create_exit = user_create_proc.wait()
            logger.info(f"User creation exit code: {user_create_exit}")
            
            # Add swarm user to sudo group
            sudo_proc = sb.exec("usermod", "-aG", "sudo", "swarm")
            sudo_exit = sudo_proc.wait()
            logger.info(f"Sudo group addition exit code: {sudo_exit}")
            
            # Set passwordless sudo for swarm user
            sudoers_proc = sb.exec("bash", "-c", "echo 'swarm ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers")
            sudoers_exit = sudoers_proc.wait()
            logger.info(f"Sudoers configuration exit code: {sudoers_exit}")
            
            # Create and set ownership of home directory
            mkdir_proc = sb.exec("mkdir", "-p", "/home/swarm")
            mkdir_exit = mkdir_proc.wait()
            logger.info(f"Directory creation exit code: {mkdir_exit}")
            
            # Change ownership of home directory to swarm user
            chown_proc = sb.exec("chown", "-R", "swarm:swarm", "/home/swarm")
            chown_exit = chown_proc.wait()
            logger.info(f"Directory ownership change exit code: {chown_exit}")
            
            logger.info("Successfully created swarm user and configured permissions")
            
        except Exception as user_error:
            logger.error(f"Failed to create swarm user: {user_error}")
            # Don't fail sandbox creation - continue with root user as fallback
        
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
                # Verify the clone was successful
                verify_proc = sb.exec("su", "-", "swarm", "-c", f"ls -la /home/swarm/{repo_name}")
                verify_exit_code = verify_proc.wait()
                logger.info(f"Directory listing exit code: {verify_exit_code}")
                
                # Try to get output
                try:
                    if hasattr(verify_proc, 'stdout') and verify_proc.stdout:
                        stdout = verify_proc.stdout.read() if hasattr(verify_proc.stdout, 'read') else str(verify_proc.stdout)
                        logger.info(f"Directory contents: {stdout}")
                except Exception as output_error:
                    logger.warning(f"Could not read directory listing output: {output_error}")
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

        # Install Claude Code during sandbox creation as swarm user
        try:
            logger.info("Installing dependencies for Claude Code")
            # Install jq which is required by the Claude Code installer
            deps_proc = sb.exec("bash", "-c", "apt-get update && apt-get install -y jq")
            deps_exit_code = deps_proc.wait()
            logger.info(f"Dependencies install exit code: {deps_exit_code}")
            
            logger.info("Installing Claude Code as swarm user")
            # Install Claude Code as swarm user to avoid root permission issues
            install_proc = sb.exec("su", "-", "swarm", "-c", "curl -fsSL http://claude.ai/install.sh | bash")
            install_exit_code = install_proc.wait()
            logger.info(f"Claude Code install exit code: {install_exit_code}")
            
            if install_exit_code == 0:
                logger.info("Claude Code installation succeeded")
                # Verify installation as swarm user
                verify_proc = sb.exec("su", "-", "swarm", "-c", "export PATH=\"$HOME/.local/bin:$PATH\" && which claude && claude --version")
                verify_exit_code = verify_proc.wait()
                logger.info(f"Claude Code verification exit code: {verify_exit_code}")
                
                # Try to get verification output
                try:
                    if hasattr(verify_proc, 'stdout') and verify_proc.stdout:
                        stdout = verify_proc.stdout.read() if hasattr(verify_proc.stdout, 'read') else str(verify_proc.stdout)
                        logger.info(f"Claude Code verification output: {stdout}")
                except Exception as output_error:
                    logger.warning(f"Could not read Claude Code verification output: {output_error}")
            else:
                logger.error(f"Claude Code installation failed with exit code {install_exit_code}")
                # Try to get error output
                try:
                    if hasattr(install_proc, 'stderr') and install_proc.stderr:
                        stderr = install_proc.stderr.read() if hasattr(install_proc.stderr, 'read') else str(install_proc.stderr)
                        logger.error(f"Claude Code install error: {stderr}")
                except Exception as error_output:
                    logger.warning(f"Could not read Claude Code install error: {error_output}")
                    
        except Exception as install_error:
            logger.error(f"Claude Code installation exception: {install_error}")
            # Don't fail sandbox creation - let the backend handle it
        
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
        
        proc = sb.exec(
            "su", "-", "swarm", "-c", f"cd {workdir} && {cmd_str}",
        )
        
        # Store the actual ContainerProcess object
        PROCS[sandbox_id][proc_id] = proc
        
        logger.info(f"Executed command in sandbox {sandbox_id}: {' '.join(req.cmd)}")
        return ExecResp(proc_id=proc_id)
        
    except Exception as e:
        logger.error(f"Failed to execute command: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to execute command: {str(e)}")

@app.get("/sandboxes/{sandbox_id}/procs/{proc_id}/exit_code", response_model=ExitCodeResp)
async def get_exit_code(sandbox_id: str, proc_id: str):
    """Get the exit code of a process."""
    try:
        if sandbox_id not in PROCS or proc_id not in PROCS[sandbox_id]:
            raise HTTPException(status_code=404, detail="Process not found")
            
        proc = PROCS[sandbox_id][proc_id]
        
        # Use Modal's poll method - returns exit code if finished, None if running
        exit_code = proc.poll()
        
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
            
        proc = PROCS[sandbox_id][proc_id]
        
        # Get stdout and stderr from the ContainerProcess
        stdout = ""
        stderr = ""
        
        logger.info(f"Getting logs for proc {proc_id}, process type: {type(proc)}")
        logger.info(f"Process attributes: {dir(proc)}")
        
        try:
            # Check what attributes the process actually has
            if hasattr(proc, 'stdout'):
                logger.info(f"Process has stdout: {proc.stdout}, type: {type(proc.stdout)}")
                if proc.stdout:
                    if hasattr(proc.stdout, 'read'):
                        stdout_data = proc.stdout.read()
                        logger.info(f"Read stdout data: {stdout_data}")
                    else:
                        stdout_data = str(proc.stdout)
                        logger.info(f"Converted stdout to string: {stdout_data}")
                    stdout = stdout_data[since:] if since > 0 and len(stdout_data) > since else stdout_data
            else:
                logger.info("Process does not have stdout attribute")
                
            if hasattr(proc, 'stderr'):
                logger.info(f"Process has stderr: {proc.stderr}, type: {type(proc.stderr)}")
                if proc.stderr:
                    if hasattr(proc.stderr, 'read'):
                        stderr_data = proc.stderr.read()
                        logger.info(f"Read stderr data: {stderr_data}")
                    else:
                        stderr_data = str(proc.stderr)
                        logger.info(f"Converted stderr to string: {stderr_data}")
                    stderr = stderr_data[since:] if since > 0 and len(stderr_data) > since else stderr_data
            else:
                logger.info("Process does not have stderr attribute")
                
        except Exception as e:
            logger.warning(f"Could not read stdout/stderr: {str(e)}")
        
        return LogsResp(stdout=stdout, stderr=stderr)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get logs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get logs: {str(e)}")

@app.delete("/sandboxes/{sandbox_id}")
async def terminate_sandbox(sandbox_id: str):
    """Terminate a sandbox."""
    try:
        sb = get_sb(sandbox_id)
        
        # Kill all processes first
        if sandbox_id in PROCS:
            for proc_id, proc in PROCS[sandbox_id].items():
                try:
                    if hasattr(proc, 'terminate'):
                        proc.terminate()
                    elif hasattr(proc, 'kill'):
                        proc.kill()
                except Exception as e:
                    logger.warning(f"Could not terminate process {proc_id}: {str(e)}")
        
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
    """Install Claude Code and other development tools."""
    # Commands are now automatically run as swarm user via exec_command
    exec_req = ExecReq(
        cmd=["bash", "-c", "curl -fsSL http://claude.ai/install.sh | bash"],
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

# Legacy endpoint for backward compatibility
@app.post("/create_sandbox", response_model=CreateSandboxResp)
async def create_sandbox_legacy(req: CreateSandboxReq):
    """Legacy endpoint for backward compatibility."""
    return await create_sandbox(req)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)