from fastapi import APIRouter, Request

from ...domain.models import WorkflowReq, ExecResp

router = APIRouter()


@router.post("/sandboxes/{sandbox_id}/clone_repo", response_model=ExecResp)
async def clone_repo(sandbox_id: str, req: WorkflowReq, request: Request):
    """Clone a repository to the sandbox."""
    git_service = request.app.state.svc_git
    return git_service.clone_repo(sandbox_id, req)


@router.post("/sandboxes/{sandbox_id}/install_tools", response_model=ExecResp)
async def install_tools(sandbox_id: str, request: Request):
    """Verify that development tools are available (already installed in pre-built image)."""
    process_service = request.app.state.svc_process
    from ...domain.models import ExecReq
    
    # Tools are already installed in the pre-built image, just verify availability
    exec_req = ExecReq(
        cmd=[
            "bash",
            "-c",
            "which claude && which cargo && which bun && which node && echo 'All tools available'",
        ],
        cwd="/home/swarm",
    )
    return process_service.exec(sandbox_id, exec_req)



@router.post("/sandboxes/{sandbox_id}/push_changes", response_model=ExecResp)
async def push_changes(sandbox_id: str, req: WorkflowReq, request: Request):
    """Push changes to the repository."""
    git_service = request.app.state.svc_git
    branch = req.branch or "main"
    # Note: This endpoint would need repo URL to determine the correct folder
    # For now, assume the repo is in the working directory
    return git_service.push_simple(sandbox_id, "/home/swarm", branch)