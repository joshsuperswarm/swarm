# Daytona Integration Test

This document outlines how to test the Daytona integration in the Swarm backend.

## Setup

1. **Environment Variables**: Set the following in your `.env` file:
   ```bash
   DAYTONA_URL=https://api.daytona.io
   DAYTONA_API_KEY=your_daytona_api_key_here
   ```

2. **Build Docker Image**: Build the Claude runner image:
   ```bash
   docker build -f claude-runner.Dockerfile -t ghcr.io/swarmapp/claude-runner:latest .
   ```

3. **Push to Registry**: Push the image to GitHub Container Registry:
   ```bash
   docker push ghcr.io/swarmapp/claude-runner:latest
   ```

## Testing the Integration

1. **Start the Backend**:
   ```bash
   cd backend && cargo run
   ```

2. **Create a Task**: Use the API to create a new task:
   ```bash
   curl -X POST http://localhost:3001/api/tasks \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
     -d '{
       "title": "Add a README file",
       "description": "Create a comprehensive README.md file for this project",
       "repository_id": 1
     }'
   ```

3. **Check Task Status**: Monitor the task status:
   ```bash
   curl http://localhost:3001/api/tasks \
     -H "Authorization: Bearer YOUR_CLERK_TOKEN"
   ```

## Expected Behavior

1. **Task Creation**: When a task is created, the API should return:
   - `status: "spinning"`
   - `ssh_hostname`: SSH-accessible hostname for the workspace
   - `daytona_workspace_id`: Unique workspace identifier

2. **SSH Access**: You should be able to SSH into the workspace:
   ```bash
   ssh dev@{workspace_hostname}
   ```

3. **Status Updates**: The background poller should update task status:
   - `spinning` → `running` → `pr_opened` (or `failed`)

4. **GitHub PR**: When complete, a pull request should be created in the target repository.

5. **Cleanup**: The Daytona workspace should be automatically terminated.

## Monitoring

Watch the backend logs for:
- Workspace creation confirmations
- Background poller status updates
- Error messages if workspace operations fail

## Troubleshooting

- **Authentication Errors**: Verify DAYTONA_API_KEY is correct
- **Docker Image Issues**: Ensure the Claude runner image is built and accessible
- **GitHub Token Issues**: Verify user has valid GitHub authentication
- **Repository Access**: Ensure user has access to the specified repository