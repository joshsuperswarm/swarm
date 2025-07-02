## UI

- **Create task**
  - Creates a new task and immediately assigns it to an agent.
  - Requires selecting a GitHub repo.
  - A default repo can be set in user settings.
  - Once complete, the agent updates the task with the context of what it did.
  - The result can be:
    - **Merged immediately**, or
    - **Rejected**
  - No iteration with the agent — you either accept or reject the changes.

## Login / GitHub

- Logging in requires GitHub.
- GitHub login is mandatory so we can access all your repositories.

## Backend

- **Create task**
  - Starts a sandbox environment.
  - Clones the selected GitHub repo.
  - Launches Claude Code with the given prompt.
  - Runs until Claude Code finishes.
  - Pushes the changes to a GitHub Pull Request.
  - Spins down the sandbox after task completion.
