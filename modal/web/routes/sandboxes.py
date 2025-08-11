from fastapi import APIRouter, Request
from datetime import datetime

from ...domain.models import CreateSandboxReq, CreateSandboxResp, SandboxStatusResp

router = APIRouter()


@router.post("/sandboxes", response_model=CreateSandboxResp)
async def create_sandbox(req: CreateSandboxReq, request: Request):
    """Create a new sandbox and clone the repository."""
    sandbox_service = request.app.state.svc_sandbox
    return sandbox_service.create(req)


@router.get("/sandboxes/{sandbox_id}", response_model=SandboxStatusResp)
async def get_sandbox_status(sandbox_id: str, request: Request):
    """Get the status of a sandbox."""
    sandbox_service = request.app.state.svc_sandbox
    return sandbox_service.status(sandbox_id)


@router.delete("/sandboxes/{sandbox_id}")
async def terminate_sandbox(sandbox_id: str, request: Request):
    """Terminate a sandbox."""
    sandbox_service = request.app.state.svc_sandbox
    sandbox_service.terminate(sandbox_id)
    return {"message": "Sandbox terminated"}


# Legacy endpoint for backward compatibility
@router.post("/create_sandbox", response_model=CreateSandboxResp)
async def create_sandbox_legacy(req: CreateSandboxReq, request: Request):
    """Legacy endpoint for backward compatibility."""
    sandbox_service = request.app.state.svc_sandbox
    return sandbox_service.create(req)


@router.get("/health")
async def health_check(request: Request):
    """Health check endpoint."""
    storage = request.app.state.storage
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "sandboxes": len(storage.sandboxes),
        "processes": sum(len(procs) for procs in storage.processes.values()),
    }