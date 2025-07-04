# Docker Image Build Instructions

## Building the Claude Runner Image

The Claude runner image contains all the tools needed for Claude to work autonomously in a Daytona workspace.

### Build the Image

```bash
# From the root of the swarm repository
docker build -f claude-runner.Dockerfile -t ghcr.io/swarmapp/claude-runner:latest .
```

### Test the Image Locally

```bash
# Run the container interactively to test
docker run -it --rm \
  -e GIT_REPO=https://github.com/your-org/test-repo.git \
  -e GITHUB_TOKEN=your_github_token \
  -e PROMPT="Add a simple hello world function" \
  -e TASK_ID=123 \
  ghcr.io/swarmapp/claude-runner:latest
```

### Push to Registry

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Push the image
docker push ghcr.io/swarmapp/claude-runner:latest
```

## Image Contents

- **Base**: Ubuntu 22.04
- **User**: `dev` with sudo access
- **Tools**:
  - Git
  - GitHub CLI (`gh`)
  - Claude Code CLI
  - SSH server
  - Node.js/npm
  - Python3

## Environment Variables

The container expects these environment variables:

- `GIT_REPO`: Full Git repository URL to clone
- `GITHUB_TOKEN`: GitHub personal access token
- `PROMPT`: The prompt to send to Claude
- `TASK_ID`: Unique task identifier for branch naming

## Workflow

1. Container starts and begins SSH daemon
2. Clones the specified Git repository
3. Runs Claude Code with the provided prompt
4. Creates a new branch named `swarm/ai/{TASK_ID}`
5. Commits all changes with descriptive message
6. Pushes branch to GitHub
7. Creates a pull request
8. Exits (triggering Daytona to terminate the workspace)

## SSH Access

The container exposes port 22 for SSH access. The Daytona workspace will provide a public hostname that allows direct SSH access to the running container.

To connect:
```bash
ssh dev@{workspace_hostname}
```

## Security Notes

- The container runs as a non-root user (`dev`)
- SSH authentication uses public key authentication only
- GitHub token is only used for repository operations
- Container auto-terminates after task completion