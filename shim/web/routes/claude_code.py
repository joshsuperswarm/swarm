from fastapi import APIRouter, Request

from ...domain.models import ClaudeCodeExecReq, PushChangesReq, ExecResp

router = APIRouter()


@router.post("/sandboxes/{sandbox_id}/install_claude_code", response_model=ExecResp)
async def install_claude_code(sandbox_id: str, request: Request):
    """Verify Claude Code is available (already installed in pre-built image)."""
    claude_service = request.app.state.svc_claude
    return claude_service.install_claude_code(sandbox_id)


@router.post("/sandboxes/{sandbox_id}/exec_claude_code", response_model=ExecResp)
async def exec_claude_code(sandbox_id: str, req: ClaudeCodeExecReq, request: Request):
    """Execute Claude Code with prompt and environment setup."""
    claude_service = request.app.state.svc_claude
    return claude_service.exec(sandbox_id, req)


@router.post("/sandboxes/{sandbox_id}/push_changes_advanced", response_model=ExecResp)
async def push_changes_advanced(sandbox_id: str, req: PushChangesReq, request: Request):
    """Push changes to GitHub branch with proper commit information."""
    git_service = request.app.state.svc_git
    return git_service.push_advanced(sandbox_id, req)