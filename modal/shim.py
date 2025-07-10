import modal
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class CreateReq(BaseModel):
    repo_url: str
    branch:   str = "main"

class CreateResp(BaseModel):
    sandbox_id: str
    hostname:   str

def _provision(req: CreateReq) -> CreateResp:          # runs locally
    modal_app = modal.App.lookup("swarm-sandboxes", create_if_missing=True)
    sb = modal.Sandbox.create(app=modal_app)
    sb.exec("git", "clone", req.repo_url, "/code", "-b", req.branch)
    return CreateResp(sandbox_id=sb.object_id, hostname=f"sandbox-{sb.object_id}")

# --- FastAPI layer (local or on Render) ----------------------------------
app = FastAPI()

@app.post("/create_sandbox", response_model=CreateResp)
async def create(req: CreateReq):
    return _provision(req)