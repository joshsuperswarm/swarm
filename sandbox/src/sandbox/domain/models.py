from pydantic import BaseModel
from typing import Optional, List


class CreateSandboxReq(BaseModel):
    repo_url: str
    branch: str = "main"
    region: Optional[str] = None
    github_token: Optional[str] = None
    author_name: Optional[str] = None
    author_email: Optional[str] = None


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


class ClaudeCodeExecReq(BaseModel):
    repo_path: str
    prompt: str
    task_id: int
    github_token: str
    anthropic_api_key: str
    openai_api_key: Optional[str] = None
    branch: str
    author_name: str
    author_email: str
    mode: str = "execute"  # execute, plan, or review



class ArtifactResp(BaseModel):
    body: str
    sha: str