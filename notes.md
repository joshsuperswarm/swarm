# Swarm

A **Kanban-style cloud session manager** for AI coding agents (e.g. Cloud Code, Codex, Gemini CLI), designed to:
- Track multiple agent sessions
- Run each session in a **cloud sandbox**
- Enforce test execution
- Summarize and validate session output

---

## Core Concept

Each session is treated like a task card in a Kanban UI. When you spin up a session:
- It gets its own cloud environment (Docker/VM/etc)
- You can SSH or connect via VS Code
- Tests are automatically run (or enforced to run)
- A summary of what the agent did is generated
- Sessions are stored historically and searchable

---

## Key Features

- **Kanban UI for Agent Sessions**  
  Track status of multiple concurrent or historical AI agent runs

- **Cloud Sandboxes per Session**  
  Each session runs in its own isolated environment with SSH & VS Code access

- **Test Enforcement Layer**  
  Sessions must pass tests before being marked complete

- **Session Summary & Validation**  
  Auto-generated summaries of file changes, test results, sanity checks

- **Session History + Replay**  
  Store logs, diffs, agent outputs for future review and audit

---

## Open Questions

1. **What is the user workflow?**  
   - Do users initiate sessions manually (e.g. Kanban card → session)?  
   - Or wrap existing CLI tools to auto-create sessions?

2. **Where do tests come from?**  
   - Are they detected automatically (`pytest`, `npm test`)?  
   - Should there be a config file declaring expected test commands?

3. **How agent-agnostic is it?**  
   - Should it support *any* CLI-based agent?  
   - Or focus deeply on a few (e.g. Cloud Code, Codex)?

4. **What gets summarized?**  
   - Diff of changed files? Test results?  
   - Should the summary be machine-readable? Human-readable?

5. **Should the validation logic feed back into the agent?**  
   - If tests fail, do we re-prompt the agent automatically?

6. **How should sandboxing work at MVP stage?**  
   - Fake isolation via Docker on a shared VM?  
   - Full container-per-session infra?

---

## Core Components to Build

### 1. Cloud Sandbox Launcher
- Run agent CLI in isolated env (Docker, EC2, Fly.io, etc)
- Mount repo, run commands, capture output
- Expose SSH and optional VS Code Remote support

### 2. CLI Agent Wrapper
- Standardize launching Cloud Code, Codex, etc
- Pipe output to logs and extract structured results
- Allow custom prompts per task

### 3. Test Runner & Enforcer
- Detect or use declared test commands
- Block completion if tests fail
- Log pass/fail status per session

### 4. Session Summary Generator
- Track file diffs, stdout logs, and test results
- Generate summaries for UI and potential feedback loop

### 5. Session Manager Backend
- Store session metadata, logs, and state
- Link sessions to Kanban cards
- Track agent type, test config, sandbox location, etc

### 6. Kanban UI
- Visualize sessions and their state
- Click into session for logs, diffs, test results
- Create new sessions / assign agent tasks

---

## MVP Build Path (4–6 Weeks Solo)

1. Docker-based sandboxing with basic CLI runner  
2. Test auto-detection for common languages  
3. Session tracker (CLI or simple web UI)  
4. Log collection + basic summaries  
5. Manual Kanban UI or CLI-based task tracker