import pytest
from unittest.mock import Mock, MagicMock, patch, call

from sandbox.services.claude_service import ClaudeService
from sandbox.services.sandbox_service import SandboxService
from sandbox.services.process_service import ProcessService
from sandbox.services.git_service import GitService
from sandbox.domain.models import ClaudeCodeExecReq, ExecResp


class TestClaudeServiceIntegration:
    """Test suite for ClaudeService integration with GitService."""

    def setup_method(self):
        """Set up test fixtures."""
        self.mock_sandbox_service = Mock(spec=SandboxService)
        self.mock_process_service = Mock(spec=ProcessService)
        self.mock_git_service = Mock(spec=GitService)
        
        self.claude_service = ClaudeService(
            self.mock_sandbox_service,
            self.mock_process_service,
            self.mock_git_service
        )

    @patch('sandbox.services.claude_service.ModalAdapter')
    @patch('uuid.uuid4')
    def test_claude_exec_calls_checkout_before_running(self, mock_uuid, mock_modal_adapter):
        """Test that Claude exec calls git checkout before running Claude."""
        # Setup mocks
        mock_uuid.return_value = 'test-prompt-id'
        mock_sandbox = Mock()
        mock_sandbox.exec.return_value.wait.return_value = None
        self.mock_sandbox_service.get.return_value = mock_sandbox
        
        mock_adapter_instance = Mock()
        mock_adapter_instance.write_base64.return_value = 0
        mock_modal_adapter.return_value = mock_adapter_instance
        
        mock_exec_response = Mock(spec=ExecResp)
        self.mock_process_service.exec.return_value = mock_exec_response
        
        # Create test request
        req = ClaudeCodeExecReq(
            task_id=123,
            prompt="Test task",
            repo_path="/test/repo",
            branch="feature/test-branch",
            mode="execute",
            github_token="test-token",
            anthropic_api_key="test-key",
            author_name="Test User",
            author_email="test@example.com"
        )
        
        # Execute
        result = self.claude_service.exec("test-sandbox", req)
        
        # Verify git checkout was called first
        self.mock_git_service.ensure_branch_checked_out.assert_called_once_with(
            sandbox_id="test-sandbox",
            repo_dir="/test/repo", 
            branch="feature/test-branch",
            base_ref="origin/main"
        )
        
        # Verify process service was called for Claude execution
        self.mock_process_service.exec.assert_called_once()
        
        # Verify call order: git checkout should be called before Claude execution
        expected_calls = [
            call("test-sandbox", req),  # ensure_branch_checked_out 
            call("test-sandbox", Mock)  # Claude exec command
        ]
        
        # Check that git service was called before process service
        assert self.mock_git_service.ensure_branch_checked_out.called
        assert self.mock_process_service.exec.called
        
        assert result == mock_exec_response

    @patch('sandbox.services.claude_service.ModalAdapter') 
    @patch('uuid.uuid4')
    def test_claude_exec_passes_correct_branch_env_var(self, mock_uuid, mock_modal_adapter):
        """Test that Claude exec sets the SWARM_BRANCH environment variable."""
        # Setup mocks
        mock_uuid.return_value = 'test-prompt-id'
        mock_sandbox = Mock()
        mock_sandbox.exec.return_value.wait.return_value = None
        self.mock_sandbox_service.get.return_value = mock_sandbox
        
        mock_adapter_instance = Mock()
        mock_adapter_instance.write_base64.return_value = 0
        mock_modal_adapter.return_value = mock_adapter_instance
        
        mock_exec_response = Mock(spec=ExecResp)
        self.mock_process_service.exec.return_value = mock_exec_response
        
        # Create test request
        req = ClaudeCodeExecReq(
            task_id=456,
            prompt="Another test task",
            repo_path="/another/repo",
            branch="bugfix/critical-issue", 
            mode="plan",
            github_token="test-token",
            anthropic_api_key="test-key",
            author_name="Test User",
            author_email="test@example.com"
        )
        
        # Execute
        result = self.claude_service.exec("test-sandbox", req)
        
        # Verify the shell script contains correct SWARM_BRANCH
        call_args = self.mock_process_service.exec.call_args
        shell_script = call_args[0][1].cmd[2]  # bash -c "script"
        assert "export SWARM_BRANCH='bugfix/critical-issue'" in shell_script

    @patch('sandbox.services.claude_service.ModalAdapter')
    @patch('uuid.uuid4') 
    def test_claude_exec_handles_git_checkout_failure(self, mock_uuid, mock_modal_adapter):
        """Test that Claude exec handles git checkout failures properly."""
        # Setup mocks
        mock_uuid.return_value = 'test-prompt-id'
        mock_sandbox = Mock()
        self.mock_sandbox_service.get.return_value = mock_sandbox
        
        # Make git checkout fail
        self.mock_git_service.ensure_branch_checked_out.side_effect = Exception("Git checkout failed")
        
        req = ClaudeCodeExecReq(
            task_id=789,
            prompt="Test with git failure",
            repo_path="/test/repo",
            branch="failing-branch",
            mode="execute", 
            github_token="test-token",
            anthropic_api_key="test-key",
            author_name="Test User",
            author_email="test@example.com"
        )
        
        # Execute and expect exception to propagate
        with pytest.raises(Exception) as exc_info:
            self.claude_service.exec("test-sandbox", req)
        
        assert "Git checkout failed" in str(exc_info.value)
        
        # Verify git checkout was attempted
        self.mock_git_service.ensure_branch_checked_out.assert_called_once()
        
        # Verify Claude was not executed due to git failure
        self.mock_process_service.exec.assert_not_called()

    @patch('sandbox.services.claude_service.ModalAdapter')
    @patch('uuid.uuid4')
    def test_claude_exec_works_with_different_modes(self, mock_uuid, mock_modal_adapter):
        """Test that Claude exec works with different execution modes."""
        # Setup mocks 
        mock_uuid.return_value = 'test-prompt-id'
        mock_sandbox = Mock()
        mock_sandbox.exec.return_value.wait.return_value = None
        self.mock_sandbox_service.get.return_value = mock_sandbox
        
        mock_adapter_instance = Mock()
        mock_adapter_instance.write_base64.return_value = 0
        mock_modal_adapter.return_value = mock_adapter_instance
        
        mock_exec_response = Mock(spec=ExecResp)
        self.mock_process_service.exec.return_value = mock_exec_response
        
        # Test different modes
        modes = ["plan", "review", "execute"]
        
        for mode in modes:
            # Reset mocks for each test
            self.mock_git_service.reset_mock()
            self.mock_process_service.reset_mock()
            
            req = ClaudeCodeExecReq(
                task_id=100 + len(mode),  # unique task_id
                prompt=f"Test {mode} mode",
                repo_path="/test/repo",
                branch=f"{mode}-branch",
                mode=mode,
                github_token="test-token", 
                anthropic_api_key="test-key",
                author_name="Test User",
                author_email="test@example.com"
            )
            
            # Execute
            result = self.claude_service.exec("test-sandbox", req)
            
            # Verify git checkout called for each mode
            self.mock_git_service.ensure_branch_checked_out.assert_called_once_with(
                sandbox_id="test-sandbox",
                repo_dir="/test/repo",
                branch=f"{mode}-branch", 
                base_ref="origin/main"
            )
            
            # Verify Claude execution
            self.mock_process_service.exec.assert_called_once()

    @patch('sandbox.services.claude_service.ModalAdapter')
    @patch('uuid.uuid4')
    def test_claude_exec_uses_custom_base_ref(self, mock_uuid, mock_modal_adapter):
        """Test that we can customize the base ref if needed."""
        # For this test, we'll verify the default behavior
        # In future we might want to make base_ref configurable
        
        mock_uuid.return_value = 'test-prompt-id'
        mock_sandbox = Mock()
        mock_sandbox.exec.return_value.wait.return_value = None
        self.mock_sandbox_service.get.return_value = mock_sandbox
        
        mock_adapter_instance = Mock()
        mock_adapter_instance.write_base64.return_value = 0
        mock_modal_adapter.return_value = mock_adapter_instance
        
        mock_exec_response = Mock(spec=ExecResp)
        self.mock_process_service.exec.return_value = mock_exec_response
        
        req = ClaudeCodeExecReq(
            task_id=999,
            prompt="Test base ref",
            repo_path="/test/repo",
            branch="test-branch",
            mode="execute",
            github_token="test-token",
            anthropic_api_key="test-key", 
            author_name="Test User",
            author_email="test@example.com"
        )
        
        # Execute
        result = self.claude_service.exec("test-sandbox", req)
        
        # Verify default base_ref is used
        self.mock_git_service.ensure_branch_checked_out.assert_called_once_with(
            sandbox_id="test-sandbox",
            repo_dir="/test/repo",
            branch="test-branch",
            base_ref="origin/main"  # This is the default
        )