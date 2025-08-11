class SandboxError(Exception):
    """Base exception for sandbox operations."""
    pass


class SandboxNotFoundError(SandboxError):
    """Raised when a sandbox is not found."""
    pass


class ProcessNotFoundError(SandboxError):
    """Raised when a process is not found."""
    pass


class ExecError(SandboxError):
    """Raised when command execution fails."""
    pass