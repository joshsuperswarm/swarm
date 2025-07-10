import pytest
import httpx
import asyncio
from unittest.mock import Mock, patch, MagicMock
import uuid
from fastapi.testclient import TestClient

# Import the app
from ..shim import app, SANDBOXES, PROCS

client = TestClient(app)

@pytest.fixture
def mock_modal_sandbox():
    """Mock Modal sandbox for testing."""
    with patch('modal.Sandbox') as mock_sandbox:
        # Create a mock sandbox instance
        mock_sb = Mock()
        mock_sb.object_id = "test-sandbox-123"
        mock_sb.exec.return_value = Mock()
        mock_sb.poll.return_value = None  # Running
        mock_sb.terminate.return_value = None
        
        # Mock the class methods
        mock_sandbox.create.return_value = mock_sb
        mock_sandbox.from_id.return_value = mock_sb
        
        yield mock_sb

@pytest.fixture
def mock_process():
    """Mock process for testing."""
    proc = Mock()
    proc.poll.return_value = 0  # Completed successfully
    proc.stdout = Mock()
    proc.stderr = Mock()
    proc.stdout.read.return_value = "Hello, World!\n"
    proc.stderr.read.return_value = ""
    return proc

class TestSandboxAPI:
    """Test suite for sandbox API endpoints."""
    
    def test_health_check(self):
        """Test health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
    
    def test_create_sandbox(self, mock_modal_sandbox):
        """Test creating a sandbox."""
        # Clear any existing state
        SANDBOXES.clear()
        PROCS.clear()
        
        request_data = {
            "repo_url": "https://github.com/test/repo.git",
            "branch": "main"
        }
        
        response = client.post("/sandboxes", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "sandbox_id" in data
        assert "hostname" in data
        assert data["sandbox_id"] == "test-sandbox-123"
        assert data["hostname"] == "sandbox-test-sandbox-123"
        
        # Verify sandbox was stored
        assert "test-sandbox-123" in SANDBOXES
        assert "test-sandbox-123" in PROCS
        
        # Verify git clone was called
        mock_modal_sandbox.exec.assert_called_with(
            "git", "clone", request_data["repo_url"], "/code", "-b", "main"
        )
    
    def test_create_sandbox_with_region(self, mock_modal_sandbox):
        """Test creating a sandbox with specific region."""
        SANDBOXES.clear()
        PROCS.clear()
        
        request_data = {
            "repo_url": "https://github.com/test/repo.git",
            "branch": "develop",
            "region": "us-west"
        }
        
        response = client.post("/sandboxes", json=request_data)
        assert response.status_code == 200
        
        # Verify region was passed to Modal
        with patch('modal.Sandbox') as mock_sandbox:
            mock_sandbox.create.assert_called_with(region="us-west")
    
    def test_exec_command(self, mock_modal_sandbox, mock_process):
        """Test executing a command in a sandbox."""
        # Setup sandbox
        SANDBOXES["test-sandbox-123"] = mock_modal_sandbox
        PROCS["test-sandbox-123"] = {}
        
        # Mock exec to return our mock process
        mock_modal_sandbox.exec.return_value = mock_process
        
        request_data = {
            "cmd": ["echo", "Hello, World!"],
            "cwd": "/code"
        }
        
        response = client.post("/sandboxes/test-sandbox-123/exec", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "proc_id" in data
        
        # Verify process was stored
        proc_id = data["proc_id"]
        assert proc_id in PROCS["test-sandbox-123"]
        
        # Verify exec was called with correct parameters
        mock_modal_sandbox.exec.assert_called_with(
            "echo", "Hello, World!",
            text=True, stream=True, workdir="/code"
        )
    
    def test_exec_command_no_cwd(self, mock_modal_sandbox, mock_process):
        """Test executing a command without specifying cwd."""
        SANDBOXES["test-sandbox-123"] = mock_modal_sandbox
        PROCS["test-sandbox-123"] = {}
        
        mock_modal_sandbox.exec.return_value = mock_process
        
        request_data = {
            "cmd": ["pwd"]
        }
        
        response = client.post("/sandboxes/test-sandbox-123/exec", json=request_data)
        assert response.status_code == 200
        
        # Verify exec was called without workdir
        mock_modal_sandbox.exec.assert_called_with(
            "pwd", text=True, stream=True
        )
    
    def test_get_exit_code(self, mock_modal_sandbox, mock_process):
        """Test getting exit code of a process."""
        # Setup
        SANDBOXES["test-sandbox-123"] = mock_modal_sandbox
        PROCS["test-sandbox-123"] = {"proc-456": mock_process}
        
        mock_process.poll.return_value = 0
        
        response = client.get("/sandboxes/test-sandbox-123/procs/proc-456/exit_code")
        assert response.status_code == 200
        
        data = response.json()
        assert data["code"] == 0
    
    def test_get_exit_code_still_running(self, mock_modal_sandbox, mock_process):
        """Test getting exit code of a running process."""
        SANDBOXES["test-sandbox-123"] = mock_modal_sandbox
        PROCS["test-sandbox-123"] = {"proc-456": mock_process}
        
        mock_process.poll.return_value = None  # Still running
        
        response = client.get("/sandboxes/test-sandbox-123/procs/proc-456/exit_code")
        assert response.status_code == 200
        
        data = response.json()
        assert data["code"] is None
    
    def test_get_logs(self, mock_modal_sandbox, mock_process):
        """Test getting logs from a process."""
        SANDBOXES["test-sandbox-123"] = mock_modal_sandbox
        PROCS["test-sandbox-123"] = {"proc-456": mock_process}
        
        response = client.get("/sandboxes/test-sandbox-123/procs/proc-456/logs")
        assert response.status_code == 200
        
        data = response.json()
        assert data["stdout"] == "Hello, World!\n"
        assert data["stderr"] == ""
    
    def test_get_logs_with_offset(self, mock_modal_sandbox, mock_process):
        """Test getting logs with offset."""
        SANDBOXES["test-sandbox-123"] = mock_modal_sandbox
        PROCS["test-sandbox-123"] = {"proc-456": mock_process}
        
        response = client.get("/sandboxes/test-sandbox-123/procs/proc-456/logs?since=7")
        assert response.status_code == 200
        
        data = response.json()
        assert data["stdout"] == "World!\n"  # After offset 7
    
    def test_get_sandbox_status(self, mock_modal_sandbox):
        """Test getting sandbox status."""
        SANDBOXES["test-sandbox-123"] = mock_modal_sandbox
        
        # Test running status
        mock_modal_sandbox.poll.return_value = None
        response = client.get("/sandboxes/test-sandbox-123")
        assert response.status_code == 200
        assert response.json()["status"] == "running"
        
        # Test stopped status
        mock_modal_sandbox.poll.return_value = 0
        response = client.get("/sandboxes/test-sandbox-123")
        assert response.status_code == 200
        assert response.json()["status"] == "stopped"
        
        # Test failed status
        mock_modal_sandbox.poll.return_value = 1
        response = client.get("/sandboxes/test-sandbox-123")
        assert response.status_code == 200
        assert response.json()["status"] == "failed"
    
    def test_terminate_sandbox(self, mock_modal_sandbox):
        """Test terminating a sandbox."""
        SANDBOXES["test-sandbox-123"] = mock_modal_sandbox
        PROCS["test-sandbox-123"] = {}
        
        response = client.delete("/sandboxes/test-sandbox-123")
        assert response.status_code == 200
        
        data = response.json()
        assert data["message"] == "Sandbox terminated"
        
        # Verify cleanup
        assert "test-sandbox-123" not in SANDBOXES
        assert "test-sandbox-123" not in PROCS
        
        # Verify terminate was called
        mock_modal_sandbox.terminate.assert_called_once()
    
    def test_workflow_clone_repo(self, mock_modal_sandbox, mock_process):
        """Test workflow helper: clone repo."""
        SANDBOXES["test-sandbox-123"] = mock_modal_sandbox
        PROCS["test-sandbox-123"] = {}
        mock_modal_sandbox.exec.return_value = mock_process
        
        request_data = {
            "repo_url": "https://github.com/test/repo.git",
            "branch": "feature"
        }
        
        response = client.post("/sandboxes/test-sandbox-123/clone_repo", json=request_data)
        assert response.status_code == 200
        
        # Verify git clone was called
        mock_modal_sandbox.exec.assert_called_with(
            "git", "clone", request_data["repo_url"], "/code", "-b", "feature",
            text=True, stream=True, workdir="/"
        )
    
    def test_workflow_install_tools(self, mock_modal_sandbox, mock_process):
        """Test workflow helper: install tools."""
        SANDBOXES["test-sandbox-123"] = mock_modal_sandbox
        PROCS["test-sandbox-123"] = {}
        mock_modal_sandbox.exec.return_value = mock_process
        
        response = client.post("/sandboxes/test-sandbox-123/install_tools")
        assert response.status_code == 200
        
        # Verify install command was called
        mock_modal_sandbox.exec.assert_called_with(
            "bash", "-c", "apt-get update && apt-get install -y curl wget git vim nano",
            text=True, stream=True, workdir="/"
        )
    
    def test_workflow_configure_git(self, mock_modal_sandbox, mock_process):
        """Test workflow helper: configure git."""
        SANDBOXES["test-sandbox-123"] = mock_modal_sandbox
        PROCS["test-sandbox-123"] = {}
        mock_modal_sandbox.exec.return_value = mock_process
        
        request_data = {
            "user_name": "Test User",
            "user_email": "test@example.com"
        }
        
        response = client.post("/sandboxes/test-sandbox-123/configure_git", json=request_data)
        assert response.status_code == 200
        
        # Verify git config was called
        expected_cmd = "git config --global user.name 'Test User' && git config --global user.email 'test@example.com'"
        mock_modal_sandbox.exec.assert_called_with(
            "bash", "-c", expected_cmd,
            text=True, stream=True, workdir="/code"
        )
    
    def test_workflow_push_changes(self, mock_modal_sandbox, mock_process):
        """Test workflow helper: push changes."""
        SANDBOXES["test-sandbox-123"] = mock_modal_sandbox
        PROCS["test-sandbox-123"] = {}
        mock_modal_sandbox.exec.return_value = mock_process
        
        request_data = {
            "branch": "feature"
        }
        
        response = client.post("/sandboxes/test-sandbox-123/push_changes", json=request_data)
        assert response.status_code == 200
        
        # Verify git push was called
        expected_cmd = "git add . && git commit -m 'Auto-commit changes' && git push origin feature"
        mock_modal_sandbox.exec.assert_called_with(
            "bash", "-c", expected_cmd,
            text=True, stream=True, workdir="/code"
        )
    
    def test_legacy_endpoint(self, mock_modal_sandbox):
        """Test legacy create_sandbox endpoint."""
        SANDBOXES.clear()
        PROCS.clear()
        
        request_data = {
            "repo_url": "https://github.com/test/repo.git",
            "branch": "main"
        }
        
        response = client.post("/create_sandbox", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "sandbox_id" in data
        assert "hostname" in data
    
    def test_error_handling_sandbox_not_found(self):
        """Test error handling when sandbox not found."""
        SANDBOXES.clear()
        
        with patch('modal.Sandbox.from_id') as mock_from_id:
            mock_from_id.side_effect = Exception("Not found")
            
            response = client.post("/sandboxes/nonexistent/exec", json={"cmd": ["echo", "test"]})
            assert response.status_code == 404
    
    def test_error_handling_process_not_found(self):
        """Test error handling when process not found."""
        response = client.get("/sandboxes/test-sandbox-123/procs/nonexistent/exit_code")
        assert response.status_code == 404
        
        data = response.json()
        assert "Process not found" in data["detail"]

if __name__ == "__main__":
    pytest.main([__file__, "-v"])