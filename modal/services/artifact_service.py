import hashlib
import logging
from fastapi import HTTPException

from ..domain.models import ArtifactResp
from ..domain.errors import SandboxNotFoundError
from ..utils.config import SWARM_HOME
from ..utils.logging import get_logger
from ..adapters.modal_adapter import ModalAdapter
from .sandbox_service import SandboxService


class ArtifactService:
    """Service for artifact operations."""
    
    def __init__(self, sandbox_service: SandboxService):
        self.sandbox_service = sandbox_service
        self.logger = get_logger(__name__)
    
    def read(self, sandbox_id: str, task_id: int, run_mode: str) -> ArtifactResp:
        """Fetch artifact from .swarm directory inside Modal container."""
        try:
            sb = self.sandbox_service.get(sandbox_id)
            adapter = ModalAdapter(sb, self.logger)
            
            path = f"{SWARM_HOME}/swarm/.swarm/task-{task_id}-{run_mode}.md"

            # Check if file exists in container
            if not adapter.file_exists(path):
                raise HTTPException(
                    status_code=404, detail=f"Artifact file {path} not found"
                )

            # Read the file content from container
            try:
                content = adapter.cat(path)
            except Exception as e:
                raise HTTPException(
                    status_code=500, detail=f"Failed to read artifact file: {str(e)}"
                )

            # Generate SHA-1 hash of the content
            sha = hashlib.sha1(content.encode("utf-8")).hexdigest()

            self.logger.info(f"Successfully fetched artifact {path} (sha: {sha[:8]})")

            return ArtifactResp(body=content, sha=sha)

        except HTTPException:
            raise
        except SandboxNotFoundError:
            raise HTTPException(status_code=404, detail=f"Sandbox {sandbox_id} not found")
        except Exception as e:
            self.logger.error(f"Failed to fetch artifact for run_mode {run_mode}: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to fetch artifact: {str(e)}"
            )