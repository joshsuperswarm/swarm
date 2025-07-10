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
        
        # Create Modal sandbox with app
        sb = modal.Sandbox.create(
            "python:3.11-slim",  # Base image
            workdir="/workspace",
            timeout=3600,  # 1 hour timeout
            app=app_modal,
        )
        
        # Store in memory
        SANDBOXES[sandbox_id] = sb
        PROCS[sandbox_id] = {}
        
        # Install git and clone repository
        sb.exec("apt-get", "update")
        sb.exec("apt-get", "install", "-y", "git", "curl")
        sb.exec("git", "clone", req.repo_url, "/code", "-b", req.branch)
        
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
        workdir = req.cwd or "/workspace"
        
        # Execute command using Modal's exec method
        proc = sb.exec(
            *cmd_parts,
            workdir=workdir,
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
        
        try:
            if hasattr(proc, 'stdout') and proc.stdout:
                stdout_data = proc.stdout.read() if hasattr(proc.stdout, 'read') else str(proc.stdout)
                stdout = stdout_data[since:] if since > 0 and len(stdout_data) > since else stdout_data
                
            if hasattr(proc, 'stderr') and proc.stderr:
                stderr_data = proc.stderr.read() if hasattr(proc.stderr, 'read') else str(proc.stderr)
                stderr = stderr_data[since:] if since > 0 and len(stderr_data) > since else stderr_data
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
    
    exec_req = ExecReq(
        cmd=["git", "clone", req.repo_url, "/code", "-b", req.branch or "main"],
        cwd="/"
    )
    return await exec_command(sandbox_id, exec_req)

@app.post("/sandboxes/{sandbox_id}/install_tools", response_model=ExecResp)
async def install_tools(sandbox_id: str):
    """Install Claude Code and other development tools."""
    exec_req = ExecReq(
        cmd=["bash", "-c", "curl -fsSL http://claude.ai/install.sh | bash"],
        cwd="/"
    )
    return await exec_command(sandbox_id, exec_req)

@app.post("/sandboxes/{sandbox_id}/configure_git", response_model=ExecResp)
async def configure_git(sandbox_id: str, req: WorkflowReq):
    """Configure Git user settings."""
    if not req.user_name or not req.user_email:
        raise HTTPException(status_code=400, detail="user_name and user_email are required")
    
    exec_req = ExecReq(
        cmd=["bash", "-c", f"git config --global user.name '{req.user_name}' && git config --global user.email '{req.user_email}'"],
        cwd="/code"
    )
    return await exec_command(sandbox_id, exec_req)

@app.post("/sandboxes/{sandbox_id}/push_changes", response_model=ExecResp)
async def push_changes(sandbox_id: str, req: WorkflowReq):
    """Push changes to the repository."""
    branch = req.branch or "main"
    exec_req = ExecReq(
        cmd=["bash", "-c", f"git add . && git commit -m 'Auto-commit changes' && git push origin {branch}"],
        cwd="/code"
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