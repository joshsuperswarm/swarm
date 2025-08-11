import modal
from fastapi import FastAPI

from ..utils.logging import get_logger
from ..services.storage import InMemoryStorage, DictProxy
from ..services.sandbox_service import SandboxService
from ..services.process_service import ProcessService
from ..services.git_service import GitService
from ..services.claude_service import ClaudeService
from ..services.artifact_service import ArtifactService

from .routes import sandboxes, procs, workflows, claude_code, artifacts


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(title="Modal Sandbox Shim", version="1.0.0")
    
    # Configure logging
    logger = get_logger(__name__)
    
    # Create Modal app for sandbox management (with fallback for testing)
    try:
        app_modal = modal.App.lookup("sandbox-shim", create_if_missing=True)
        # Import swarm image
        from ..modal_image import image as swarm_dev_img
    except Exception as e:
        logger.warning(f"Could not create Modal app (testing mode?): {e}")
        # Use mock objects for testing
        app_modal = None
        swarm_dev_img = None
    
    # Create storage and services once at startup
    storage = InMemoryStorage()
    
    sandbox_service = SandboxService(storage, app_modal, swarm_dev_img)
    process_service = ProcessService(storage, sandbox_service)
    git_service = GitService(process_service)
    claude_service = ClaudeService(sandbox_service, process_service)
    artifact_service = ArtifactService(sandbox_service)
    
    # Attach to app state for dependency injection
    app.state.storage = storage
    app.state.svc_sandbox = sandbox_service
    app.state.svc_process = process_service
    app.state.svc_git = git_service
    app.state.svc_claude = claude_service
    app.state.svc_artifact = artifact_service
    
    # Include all routers with no prefix to maintain path compatibility
    app.include_router(sandboxes.router)
    app.include_router(procs.router)
    app.include_router(workflows.router)
    app.include_router(claude_code.router)
    app.include_router(artifacts.router)
    
    logger.info("FastAPI application created and configured")
    return app


# Create the app instance
app = create_app()