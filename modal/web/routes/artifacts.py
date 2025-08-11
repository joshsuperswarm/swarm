from fastapi import APIRouter, Request

from ...domain.models import ArtifactResp

router = APIRouter()


@router.get("/artifacts/{sandbox_id}/{task_id}/{run_mode}", response_model=ArtifactResp)
async def get_artifact(sandbox_id: str, task_id: int, run_mode: str, request: Request):
    """Fetch artifact from .swarm directory inside Modal container."""
    artifact_service = request.app.state.svc_artifact
    return artifact_service.read(sandbox_id, task_id, run_mode)