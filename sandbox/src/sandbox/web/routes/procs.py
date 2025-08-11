from fastapi import APIRouter, Request

from ...domain.models import ExecReq, ExecResp, ExitCodeResp, LogsResp

router = APIRouter()


@router.post("/sandboxes/{sandbox_id}/exec", response_model=ExecResp)
async def exec_command(sandbox_id: str, req: ExecReq, request: Request):
    """Execute a command in the sandbox."""
    process_service = request.app.state.svc_process
    return process_service.exec(sandbox_id, req)


@router.get("/sandboxes/{sandbox_id}/procs/{proc_id}/exit_code", response_model=ExitCodeResp)
async def get_exit_code(sandbox_id: str, proc_id: str, request: Request):
    """Get the exit code of a process, ensuring all output is consumed first."""
    process_service = request.app.state.svc_process
    return process_service.exit_code(sandbox_id, proc_id)


@router.get("/sandboxes/{sandbox_id}/procs/{proc_id}/logs", response_model=LogsResp)
async def get_logs(sandbox_id: str, proc_id: str, since: int = 0, request: Request = None):
    """Get logs from a process starting from a specific offset."""
    process_service = request.app.state.svc_process
    return process_service.logs(sandbox_id, proc_id, since)


@router.get("/sandboxes/{sandbox_id}/procs/{proc_id}/logs_once", response_model=LogsResp)
async def get_logs_once(sandbox_id: str, proc_id: str, request: Request):
    """Get current buffer contents immediately without blocking."""
    process_service = request.app.state.svc_process
    return process_service.logs_once(sandbox_id, proc_id)