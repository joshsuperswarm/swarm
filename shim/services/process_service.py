import uuid
import time
import threading
import logging
from typing import Dict, Any, Optional
from fastapi import HTTPException
from modal.stream_type import StreamType

from ..domain.models import ExecReq, ExecResp, ExitCodeResp, LogsResp
from ..domain.errors import SandboxNotFoundError, ProcessNotFoundError
from ..adapters.modal_adapter import ModalAdapter
from ..utils.config import DEFAULT_WORKDIR, PATH_EXPORT
from ..utils.logging import get_logger
from .storage import InMemoryStorage
from .sandbox_service import SandboxService


class ProcessService:
    """Service for process execution and log streaming."""
    
    def __init__(self, storage: InMemoryStorage, sandbox_service: SandboxService):
        self.storage = storage
        self.sandbox_service = sandbox_service
        self.logger = get_logger(__name__)
    
    def exec(self, sandbox_id: str, req: ExecReq) -> ExecResp:
        """Execute a command in the sandbox."""
        try:
            sb = self.sandbox_service.get(sandbox_id)
            proc_id = str(uuid.uuid4())

            # Build command with working directory
            cmd_parts = req.cmd
            workdir = req.cwd or DEFAULT_WORKDIR

            # Execute command as swarm user using Modal's exec method
            # Build the command to run as swarm user
            cmd_str = " ".join(f"'{part}'" for part in cmd_parts)

            self.logger.info(
                f"Executing command in sandbox {sandbox_id}: {' '.join(req.cmd)} (cwd: {workdir})"
            )

            proc = sb.exec(
                "su",
                "-",
                "swarm",
                "-c",
                f"cd {workdir} && {cmd_str}",
                stdout=StreamType.PIPE,
                stderr=StreamType.PIPE,
                bufsize=1,
            )

            # Create buffer key and start background thread to consume output
            buffer_key = (sandbox_id, proc_id)
            stdout_complete, stderr_complete = self._tail_process_output(proc, buffer_key)

            # Store the actual ContainerProcess object and completion events
            self.storage.processes[sandbox_id][proc_id] = {
                "proc": proc,
                "buffer_key": buffer_key,
                "stdout_complete": stdout_complete,
                "stderr_complete": stderr_complete,
                "output_fully_consumed": False,
            }

            # Check for immediate command failure
            time.sleep(0.1)  # Brief pause to allow immediate failures to be detected
            exit_code = proc.poll()
            if exit_code is not None:
                self.logger.error(
                    f"Command failed immediately with exit code {exit_code}: {' '.join(req.cmd)}"
                )
                # Give a moment for any error output to be captured
                time.sleep(0.5)
                # Log any captured stderr immediately
                current_stderr = "".join(self.storage.log_buffers[buffer_key]["stderr"])
                if current_stderr.strip():
                    self.logger.error(
                        f"Immediate command failure stderr: {current_stderr.strip()}"
                    )

            self.logger.info(f"Command started in sandbox {sandbox_id} with proc_id {proc_id}")
            return ExecResp(proc_id=proc_id)

        except Exception as e:
            self.logger.error(f"Failed to execute command: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to execute command: {str(e)}"
            )
    
    def exit_code(self, sandbox_id: str, proc_id: str) -> ExitCodeResp:
        """Get the exit code of a process, ensuring all output is consumed first."""
        try:
            if sandbox_id not in self.storage.processes or proc_id not in self.storage.processes[sandbox_id]:
                raise ProcessNotFoundError("Process not found")

            proc_info = self.storage.processes[sandbox_id][proc_id]
            proc = proc_info["proc"] if isinstance(proc_info, dict) else proc_info

            # Use Modal's poll method - returns exit code if finished, None if running
            exit_code = proc.poll()

            if exit_code is None:
                # Process still running - return None immediately (no blocking)
                return ExitCodeResp(code=None)

            # Log process completion
            self.logger.info(f"Process {proc_id} completed with exit code {exit_code}")

            # Process has finished - ensure all output is consumed before returning exit code
            if not proc_info.get("output_fully_consumed", False):
                self.logger.info(
                    f"Process {proc_id} finished with exit code {exit_code}, waiting for output consumption..."
                )

                # Get completion events
                stdout_complete = proc_info.get("stdout_complete")
                stderr_complete = proc_info.get("stderr_complete")

                if stdout_complete and stderr_complete:
                    # Wait for both streams to be fully consumed (with timeout)
                    stdout_ready = stdout_complete.wait(timeout=10.0)  # 10 second timeout
                    stderr_ready = stderr_complete.wait(timeout=10.0)

                    if stdout_ready and stderr_ready:
                        self.logger.info(f"All output consumed for process {proc_id}")
                    else:
                        self.logger.warning(
                            f"Timeout waiting for output consumption for process {proc_id}"
                        )
                        # Try to get any remaining output with communicate as fallback
                        try:
                            remaining_stdout, remaining_stderr = proc.communicate(
                                timeout=5.0
                            )
                            if remaining_stdout:
                                self.storage.log_buffers[proc_info["buffer_key"]]["stdout"].extend(
                                    remaining_stdout.splitlines(True)
                                )
                            if remaining_stderr:
                                self.storage.log_buffers[proc_info["buffer_key"]]["stderr"].extend(
                                    remaining_stderr.splitlines(True)
                                )
                            self.logger.info(
                                f"Fallback communicate() captured remaining output for process {proc_id}"
                            )
                        except Exception as comm_error:
                            self.logger.warning(
                                f"Fallback communicate() failed for process {proc_id}: {str(comm_error)}"
                            )
                            # Best effort - continue anyway
                else:
                    # No completion events (older process or different execution path)
                    self.logger.info(
                        f"No completion events for process {proc_id}, assuming output consumed"
                    )

                # Mark as fully consumed
                proc_info["output_fully_consumed"] = True

            return ExitCodeResp(code=exit_code)

        except (SandboxNotFoundError, ProcessNotFoundError):
            raise HTTPException(status_code=404, detail="Process not found")
        except Exception as e:
            self.logger.error(f"Failed to get exit code: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to get exit code: {str(e)}"
            )
    
    def logs(self, sandbox_id: str, proc_id: str, since: int = 0) -> LogsResp:
        """Get logs from a process starting from a specific offset."""
        try:
            if sandbox_id not in self.storage.processes or proc_id not in self.storage.processes[sandbox_id]:
                raise ProcessNotFoundError("Process not found")

            buffer_key = (sandbox_id, proc_id)
            buffer = self.storage.log_buffers[buffer_key]

            # Get current buffer contents
            stdout_lines = list(buffer["stdout"])
            stderr_lines = list(buffer["stderr"])

            # Apply since offset (character-based for backward compatibility)
            stdout = "".join(stdout_lines)
            stderr = "".join(stderr_lines)

            if since > 0:
                stdout = stdout[since:] if len(stdout) > since else ""
                stderr = stderr[since:] if len(stderr) > since else ""

            return LogsResp(stdout=stdout, stderr=stderr)

        except ProcessNotFoundError:
            raise HTTPException(status_code=404, detail="Process not found")
        except Exception as e:
            self.logger.error(f"Failed to get logs: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to get logs: {str(e)}")
    
    def logs_once(self, sandbox_id: str, proc_id: str) -> LogsResp:
        """Get current buffer contents immediately without blocking."""
        try:
            if sandbox_id not in self.storage.processes or proc_id not in self.storage.processes[sandbox_id]:
                raise ProcessNotFoundError("Process not found")

            buffer_key = (sandbox_id, proc_id)
            buffer = self.storage.log_buffers[buffer_key]

            # Return current buffer contents immediately
            stdout = "".join(buffer["stdout"])
            stderr = "".join(buffer["stderr"])

            return LogsResp(stdout=stdout, stderr=stderr)

        except ProcessNotFoundError:
            raise HTTPException(status_code=404, detail="Process not found")
        except Exception as e:
            self.logger.error(f"Failed to get logs once: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to get logs once: {str(e)}"
            )
    
    def _tail_process_output(self, proc, key):
        """Consume process output in background threads using Modal's streaming."""
        # Create events to signal when each stream is fully consumed
        stdout_complete = threading.Event()
        stderr_complete = threading.Event()

        def consume_stdout():
            try:
                for line in proc.stdout:
                    self.storage.log_buffers[key]["stdout"].append(line)
                    # Print all stdout lines in real-time
                    self.logger.info(f"[{key[0][:8]}:{key[1][:8]}] STDOUT: {line.rstrip()}")
                # Signal completion when iterator is exhausted
                stdout_complete.set()
                self.logger.debug(f"Stdout consumption complete for {key}")
            except Exception as e:
                self.logger.warning(f"Error reading stdout for {key}: {str(e)}")
                stdout_complete.set()  # Signal even on error

        def consume_stderr():
            try:
                for line in proc.stderr:
                    self.storage.log_buffers[key]["stderr"].append(line)
                    # Print all stderr lines in real-time
                    self.logger.error(f"[{key[0][:8]}:{key[1][:8]}] STDERR: {line.rstrip()}")
                # Signal completion when iterator is exhausted
                stderr_complete.set()
                self.logger.debug(f"Stderr consumption complete for {key}")
            except Exception as e:
                self.logger.warning(f"Error reading stderr for {key}: {str(e)}")
                stderr_complete.set()  # Signal even on error

        # Start background threads to consume streams
        stdout_thread = threading.Thread(target=consume_stdout, daemon=True)
        stderr_thread = threading.Thread(target=consume_stderr, daemon=True)

        stdout_thread.start()
        stderr_thread.start()

        self.logger.debug(f"Started background streaming for process {key}")

        # Return completion events so caller can wait for them
        return stdout_complete, stderr_complete