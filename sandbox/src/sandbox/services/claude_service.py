import uuid
import shlex
import textwrap
import logging
from fastapi import HTTPException

from ..domain.models import ClaudeCodeExecReq, ExecReq, ExecResp
from ..utils.config import TMP_DIR, PATH_EXPORT, DB_URL
from ..utils.logging import get_logger
from ..adapters.modal_adapter import ModalAdapter
from .sandbox_service import SandboxService
from .process_service import ProcessService
from .git_service import GitService


class ClaudeService:
    """Service for Claude Code operations."""
    
    def __init__(self, sandbox_service: SandboxService, process_service: ProcessService, git_service: GitService):
        self.sandbox_service = sandbox_service
        self.process_service = process_service
        self.git_service = git_service
        self.logger = get_logger(__name__)
    
    def exec(self, sandbox_id: str, req: ClaudeCodeExecReq) -> ExecResp:
        """Execute Claude Code with prompt, environment, and configuration."""
        from ..prompts import (
            PLAN_MODE_INSTRUCTIONS,
            REVIEW_MODE_INSTRUCTIONS,
            EXECUTE_MODE_INSTRUCTIONS,
            CLAUDE_PROMPT_TEMPLATE,
        )
        
        sb = self.sandbox_service.get(sandbox_id)
        adapter = ModalAdapter(sb, self.logger)

        # -------- 0.  deterministically ensure we're on the right branch --------
        self.git_service.ensure_branch_checked_out(
            sandbox_id=sandbox_id,
            repo_dir=req.repo_path,
            branch=req.branch,
            base_ref="origin/main",
        )

        # -------- 1.  Create the Claude prompt with artifact markers ------------

        # Generate mode-specific prompt
        if req.mode == "plan":
            # Plan mode: use only plan mode instructions, no template overhead
            claude_prompt = f"You are working on task {req.task_id}: {req.prompt}\n\n{PLAN_MODE_INSTRUCTIONS.format(task_id=req.task_id)}"
        else:
            # Execute/Review modes: use full template with mode-specific instructions
            if req.mode == "review":
                mode_instructions = REVIEW_MODE_INSTRUCTIONS.format(task_id=req.task_id)
            else:  # execute mode
                mode_instructions = EXECUTE_MODE_INSTRUCTIONS

            claude_prompt = CLAUDE_PROMPT_TEMPLATE.format(
                task_id=req.task_id, prompt=req.prompt, mode_instructions=mode_instructions
            )

        # -------- 2.  write prompt file -----------------------------------------
        prompt_id = str(uuid.uuid4())
        prompt_dir = TMP_DIR
        prompt_path = f"{prompt_dir}/{prompt_id}.txt"

        # make sure tmp dir exists (idempotent, fast)
        sb.exec("mkdir", "-p", prompt_dir).wait()

        write_result = adapter.write_base64(prompt_path, claude_prompt)
        if write_result == 0:
            self.logger.info("Prompt written successfully to %s", prompt_path)
        else:
            self.logger.error(
                "Failed to write prompt to %s (exit code: %d)", prompt_path, write_result
            )

        # -------- 3.  build environment -----------------------------------------
        # Check if this is a continuation session by looking for existing Claude Code session
        is_continuation_session = self._check_existing_claude_session(sandbox_id, req.repo_path)

        if req.mode == "plan":
            # Plan mode: export only API keys, no GitHub token or Git environment
            env_pairs = {
                "ANTHROPIC_API_KEY": req.anthropic_api_key,
            }
            if req.openai_api_key:
                env_pairs["OPENAI_API_KEY"] = req.openai_api_key
            
            # Plan mode uses read-only permission mode with Opus model
            claude_args = "claude -p --permission-mode plan --model opus --output-format stream-json --verbose"
        else:
            # Execute/Review modes: full environment
            env_pairs = {
                "GITHUB_TOKEN": req.github_token,
                "ANTHROPIC_API_KEY": req.anthropic_api_key,
                "SWARM_TASK_ID": str(req.task_id),
                "SWARM_BRANCH": req.branch,
                "GIT_AUTHOR_NAME": req.author_name,
                "GIT_AUTHOR_EMAIL": req.author_email,
            }
            if req.openai_api_key:
                env_pairs["OPENAI_API_KEY"] = req.openai_api_key
            
            # Execute/Review modes: use --continue for session reuse
            if is_continuation_session:
                claude_args = "claude --continue -p --dangerously-skip-permissions --verbose --output-format stream-json"
                self.logger.info("Using --continue flag for session continuity in task %s", req.task_id)
            else:
                claude_args = "claude -p --dangerously-skip-permissions --verbose --output-format stream-json"

        env_setup = " && ".join(
            f"export {k}={shlex.quote(v)}" for k, v in env_pairs.items()
        )

        # -------- 4.  craft final command ---------------------------------------
        shell_script = textwrap.dedent(
            f"""
            {env_setup}
            export PATH="{PATH_EXPORT}"
            export DATABASE_URL="{DB_URL}"
            cd {shlex.quote(req.repo_path)}
            cat {shlex.quote(prompt_path)} | {claude_args}
        """
        )

        self.logger.info(f"Executing Claude Code for task {req.task_id} in repo {req.repo_path}")
        self.logger.debug(f"Claude Code shell script:\n{shell_script}")

        exec_req = ExecReq(
            cmd=["bash", "-c", shell_script],
            cwd=req.repo_path,  # still needed for container
        )
        return self.process_service.exec(sandbox_id, exec_req)
    
    def install_claude_code(self, sandbox_id: str) -> ExecResp:
        """Verify Claude Code is available (already installed in pre-built image)."""
        try:
            self.logger.info(f"Verifying Claude Code in sandbox {sandbox_id}")

            # Claude Code is already installed in the pre-built image, just verify
            verify_cmd = f"""
                export PATH="{PATH_EXPORT}" && \\
                which claude && \\
                claude --version
            """

            exec_req = ExecReq(cmd=["bash", "-c", verify_cmd], cwd="/home/swarm")

            return self.process_service.exec(sandbox_id, exec_req)

        except Exception as e:
            self.logger.error(f"Failed to verify Claude Code: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to verify Claude Code: {str(e)}"
            )
    
    def _check_existing_claude_session(self, sandbox_id: str, repo_path: str) -> bool:
        """Check if there's an existing Claude Code session in this sandbox/repo."""
        try:
            sb = self.sandbox_service.get(sandbox_id)
            
            # Check for Claude Code memory/session files in the repo directory
            # Claude Code typically stores session state in .claude/ directory
            check_cmd = f"test -d {shlex.quote(repo_path)}/.claude && echo 'exists' || echo 'none'"
            proc = sb.exec("bash", "-c", check_cmd)
            exit_code = proc.wait()
            
            if exit_code == 0:
                output = proc.stdout.read().strip()
                session_exists = output == 'exists'
                if session_exists:
                    self.logger.info("Found existing Claude Code session in %s", repo_path)
                return session_exists
            else:
                self.logger.debug("Could not check for existing Claude Code session, exit code: %s", exit_code)
                return False
                
        except Exception as e:
            self.logger.warning("Error checking for existing Claude Code session: %s", str(e))
            return False