import modal
import base64
import shlex
import logging
from modal.stream_type import StreamType
from ..utils.config import PATH_EXPORT


class ModalAdapter:
    """Adapter for Modal Sandbox operations with swarm user context."""
    
    def __init__(self, sandbox: modal.Sandbox, logger: logging.Logger):
        self.sandbox = sandbox
        self.logger = logger
    
    def run_as_swarm(self, cmd: str, workdir: str | None = None, 
                     stdout=StreamType.PIPE, stderr=StreamType.PIPE, bufsize=1):
        """Run a shell command as 'swarm' user with PATH export; returns process."""
        if workdir:
            full_cmd = f"cd {workdir} && {cmd}"
        else:
            full_cmd = cmd
            
        return self.sandbox.exec(
            "su", "-", "swarm", "-c", full_cmd,
            stdout=stdout, stderr=stderr, bufsize=bufsize
        )
    
    def write_base64(self, dst_path: str, content: str, is_text: bool = True) -> int:
        """Write content to file using base64 encoding."""
        if is_text:
            encoded_content = base64.b64encode(content.encode()).decode()
        else:
            encoded_content = content
            
        write_cmd = f"echo {shlex.quote(encoded_content)} | base64 -d > {shlex.quote(dst_path)}"
        proc = self.sandbox.exec("bash", "-c", write_cmd)
        return proc.wait()
    
    def file_exists(self, path: str) -> bool:
        """Check if file exists in container."""
        test_proc = self.sandbox.exec("test", "-f", path)
        return test_proc.wait() == 0
    
    def cat(self, path: str) -> str:
        """Read file content from container."""
        cat_proc = self.sandbox.exec("cat", path)
        exit_code = cat_proc.wait()
        if exit_code == 0:
            return cat_proc.stdout.read()
        else:
            error_msg = cat_proc.stderr.read()
            raise Exception(f"Failed to read file {path}: {error_msg}")