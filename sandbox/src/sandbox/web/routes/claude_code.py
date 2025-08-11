from fastapi import APIRouter, Request

from ...domain.models import ClaudeCodeExecReq, ExecResp

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


