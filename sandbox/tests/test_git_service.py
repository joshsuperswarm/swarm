import pytest
from unittest.mock import Mock, MagicMock
from fastapi import HTTPException

from sandbox.services.git_service import GitService
from sandbox.services.process_service import ProcessService
from sandbox.domain.models import ExecReq, ExecResp, PushChangesReq


class TestGitService:
    """Test suite for GitService."""

    def setup_method(self):
        """Set up test fixtures."""
        self.mock_process_service = Mock(spec=ProcessService)
        self.git_service = GitService(self.mock_process_service)

    def test_validate_branch_allows_valid_names(self):
        """Test that branch validation allows valid branch names."""
        valid_names = [
            "main",
            "feature/user-auth", 
            "bugfix-123",
            "release/v1.0.0",
            "user.name/feature",
            "a" * 200,  # max length
        ]
        
        for name in valid_names:
            # Should not raise exception
            GitService.validate_branch(name)

    def test_validate_branch_rejects_invalid_names(self):
        """Test that branch validation rejects invalid branch names."""
        invalid_names = [
            "",  # empty
            "/starts-with-slash",
            "ends-with-slash/",
            "double//slash",
            "with space",
            "with@at",
            "with{brace}",
            "with~tilde",
            "with^caret",
            "with:colon",
            "with\\backslash",
            "a" * 201,  # too long
        ]
        
        for name in invalid_names:
            with pytest.raises(HTTPException) as exc_info:
                GitService.validate_branch(name)
            assert exc_info.value.status_code == 400

    def test_ensure_branch_checked_out_tracks_remote(self):
        """Test checkout when remote branch exists."""
        # Mock successful remote branch check and checkout
        mock_resp = Mock(spec=ExecResp)
        self.mock_process_service.exec.return_value = mock_resp
        
        result = self.git_service.ensure_branch_checked_out(
            sandbox_id="test-sandbox",
            repo_dir="/test/repo",
            branch="feature/existing"
        )
        
        # Verify process service was called
        self.mock_process_service.exec.assert_called_once()
        call_args = self.mock_process_service.exec.call_args
        
        # Check the script contains remote branch tracking logic
        script = call_args[0][1].cmd[2]  # The bash script
        assert "ls-remote --exit-code --heads origin" in script
        assert "checkout -B" in script
        assert "origin/feature/existing" in script
        assert result == mock_resp

    def test_ensure_branch_checked_out_creates_from_main(self):
        """Test checkout when remote branch doesn't exist."""
        mock_resp = Mock(spec=ExecResp)
        self.mock_process_service.exec.return_value = mock_resp
        
        result = self.git_service.ensure_branch_checked_out(
            sandbox_id="test-sandbox",
            repo_dir="/test/repo", 
            branch="feature/new",
            base_ref="origin/develop"
        )
        
        # Verify process service was called
        self.mock_process_service.exec.assert_called_once()
        call_args = self.mock_process_service.exec.call_args
        
        # Check the script contains branch creation logic
        script = call_args[0][1].cmd[2]
        assert "checkout -B" in script
        assert "origin/develop" in script  # custom base ref
        assert "push -u origin" in script
        assert result == mock_resp

    def test_push_advanced_errors_if_wrong_branch(self):
        """Test that push_advanced errors if we're not on expected branch."""
        req = PushChangesReq(
            task_id=123,
            repo_path="/test/repo",
            branch="expected-branch",
            commit_title="Test commit",
            commit_body="Test body"
        )
        
        result = self.git_service.push_advanced("test-sandbox", req)
        
        # Verify the script checks current branch
        call_args = self.mock_process_service.exec.call_args
        script = call_args[0][1].cmd[2]
        assert 'cur=$(git rev-parse --abbrev-ref HEAD)' in script
        assert 'if [ "$cur" != \'expected-branch\' ]; then' in script
        assert 'exit 2' in script

    def test_push_advanced_stages_and_commits(self):
        """Test that push_advanced stages files and commits."""
        req = PushChangesReq(
            task_id=456,
            repo_path="/test/repo",
            branch="test-branch",
            commit_title="Feature: Add new functionality",
            commit_body="Detailed description of changes"
        )
        
        mock_resp = Mock(spec=ExecResp)
        self.mock_process_service.exec.return_value = mock_resp
        
        result = self.git_service.push_advanced("test-sandbox", req)
        
        # Verify the script stages and commits
        call_args = self.mock_process_service.exec.call_args
        script = call_args[0][1].cmd[2]
        assert "git add -A" in script
        assert "git commit -F" in script
        assert "Feature: Add new functionality" in script
        assert "Detailed description of changes" in script
        assert result == mock_resp

    def test_push_advanced_pushes_without_switching(self):
        """Test that push_advanced pushes without switching branches."""
        req = PushChangesReq(
            task_id=789,
            repo_path="/test/repo",
            branch="current-branch", 
            commit_title="Fix bug",
            commit_body="Bug fix details"
        )
        
        result = self.git_service.push_advanced("test-sandbox", req)
        
        # Verify the script just pushes (no checkout/switch)
        call_args = self.mock_process_service.exec.call_args
        script = call_args[0][1].cmd[2]
        assert "git push" in script
        # Should NOT contain branch switching commands
        assert "git checkout" not in script
        assert "git switch" not in script
        assert "-u origin" not in script  # upstream should already be set

    def test_push_advanced_validates_branch_name(self):
        """Test that push_advanced validates branch names."""
        req = PushChangesReq(
            task_id=999,
            repo_path="/test/repo",
            branch="invalid branch name",  # contains space
            commit_title="Test",
            commit_body="Test"
        )
        
        with pytest.raises(HTTPException) as exc_info:
            self.git_service.push_advanced("test-sandbox", req)
        
        assert exc_info.value.status_code == 400
        assert "Invalid branch name" in str(exc_info.value.detail)

    def test_push_advanced_handles_exceptions(self):
        """Test that push_advanced handles exceptions properly."""
        req = PushChangesReq(
            task_id=888,
            repo_path="/test/repo",
            branch="test-branch",
            commit_title="Test",
            commit_body="Test"
        )
        
        # Mock process service to raise exception
        self.mock_process_service.exec.side_effect = Exception("Process failed")
        
        with pytest.raises(HTTPException) as exc_info:
            self.git_service.push_advanced("test-sandbox", req)
        
        assert exc_info.value.status_code == 500
        assert "Failed to push changes" in str(exc_info.value.detail)

    def test_push_advanced_cleans_up_temp_files(self):
        """Test that push_advanced cleans up temporary commit message files."""
        req = PushChangesReq(
            task_id=777,
            repo_path="/test/repo", 
            branch="cleanup-test",
            commit_title="Test cleanup",
            commit_body="Testing file cleanup"
        )
        
        result = self.git_service.push_advanced("test-sandbox", req)
        
        # Verify temp file cleanup
        call_args = self.mock_process_service.exec.call_args
        script = call_args[0][1].cmd[2]
        assert "rm -f /tmp/commit_message_777" in script

    def test_ensure_branch_checked_out_validates_branch(self):
        """Test that ensure_branch_checked_out validates branch names."""
        with pytest.raises(HTTPException) as exc_info:
            self.git_service.ensure_branch_checked_out(
                sandbox_id="test",
                repo_dir="/test/repo",
                branch="invalid@branch"
            )
        
        assert exc_info.value.status_code == 400
        assert "Invalid branch name" in str(exc_info.value.detail)

    def test_ensure_branch_checked_out_uses_shell_quoting(self):
        """Test that ensure_branch_checked_out properly quotes shell arguments."""
        result = self.git_service.ensure_branch_checked_out(
            sandbox_id="test",
            repo_dir="/path with spaces/repo",
            branch="feature/test-branch" 
        )
        
        # Verify shell quoting is used
        call_args = self.mock_process_service.exec.call_args
        script = call_args[0][1].cmd[2]
        assert "'/path with spaces/repo'" in script
        assert "'feature/test-branch'" in script