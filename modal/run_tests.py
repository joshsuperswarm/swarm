#!/usr/bin/env python3
"""
Simple test script to verify Modal integration works
"""
import requests
import json
import time

BASE_URL = "http://localhost:8000"


def test_create_sandbox():
    """Test creating a sandbox"""
    print("→ Testing sandbox creation...")

    response = requests.post(
        f"{BASE_URL}/sandboxes",
        json={
            "repo_url": "https://github.com/anthropics/claude-code",
            "branch": "main",
        },
    )

    if response.status_code == 200:
        data = response.json()
        print(f"✓ Created sandbox: {data['sandbox_id']}")
        return data["sandbox_id"]
    else:
        print(f"✗ Failed to create sandbox: {response.text}")
        return None


def test_exec_command(sandbox_id):
    """Test executing a command"""
    print("→ Testing command execution...")

    response = requests.post(
        f"{BASE_URL}/sandboxes/{sandbox_id}/exec",
        json={"cmd": ["echo", "Hello World"], "cwd": "/workspace"},
    )

    if response.status_code == 200:
        data = response.json()
        print(f"✓ Executed command, proc_id: {data['proc_id']}")
        return data["proc_id"]
    else:
        print(f"✗ Failed to execute command: {response.text}")
        return None


def test_poll_process(sandbox_id, proc_id):
    """Test polling for process completion"""
    print("→ Testing process polling...")

    for i in range(10):  # Poll for up to 10 seconds
        response = requests.get(
            f"{BASE_URL}/sandboxes/{sandbox_id}/procs/{proc_id}/exit_code"
        )

        if response.status_code == 200:
            data = response.json()
            if data["code"] is not None:
                print(f"✓ Process completed with exit code: {data['code']}")
                return True
            else:
                print(f"→ Process still running (attempt {i+1}/10)")
                time.sleep(1)
        else:
            print(f"✗ Failed to poll process: {response.text}")
            return False

    print("✗ Process did not complete within timeout")
    return False


def test_get_logs(sandbox_id, proc_id):
    """Test getting process logs"""
    print("→ Testing log retrieval...")

    response = requests.get(f"{BASE_URL}/sandboxes/{sandbox_id}/procs/{proc_id}/logs")

    if response.status_code == 200:
        data = response.json()
        print(
            f"✓ Retrieved logs - stdout: '{data['stdout']}', stderr: '{data['stderr']}'"
        )
        return True
    else:
        print(f"✗ Failed to get logs: {response.text}")
        return False


def test_health_check():
    """Test health check endpoint"""
    print("→ Testing health check...")

    response = requests.get(f"{BASE_URL}/health")

    if response.status_code == 200:
        data = response.json()
        print(f"✓ Health check passed: {data}")
        return True
    else:
        print(f"✗ Health check failed: {response.text}")
        return False


def main():
    """Run all tests"""
    print("Starting Modal shim integration tests...")

    # Check if shim is running
    if not test_health_check():
        print("✗ Modal shim is not running. Start it with: python modal/shim.py")
        return

    # Create sandbox
    sandbox_id = test_create_sandbox()
    if not sandbox_id:
        return

    # Execute command
    proc_id = test_exec_command(sandbox_id)
    if not proc_id:
        return

    # Poll for completion
    if not test_poll_process(sandbox_id, proc_id):
        return

    # Get logs
    if not test_get_logs(sandbox_id, proc_id):
        return

    print("✓ All tests passed! Modal integration is working.")


if __name__ == "__main__":
    main()
