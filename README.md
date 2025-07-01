# Swarm

A Kanban-style cloud session manager for AI coding agents.

## Features

- **Kanban Board** - Drag & drop sessions between Todo, In Progress, and Done
- **Google Authentication** - Sign in with Clerk OAuth
- **AI Agent Support** - Claude Code, Codex, Gemini CLI, and custom agents
- **Session Management** - Create, edit, and track AI coding sessions
- **Cloud Sandboxes** - Isolated environments for each session (coming soon)

## Tech Stack

- **Backend**: Rust + Axum + Clerk JWT authentication
- **Frontend**: React + TypeScript + Tailwind CSS + Zustand
- **Deployment**: Render
- **Future**: Fly.io cloud sandboxes, PostgreSQL persistence

## Development

```bash
# Backend
cd backend && cargo run

# Frontend  
cd frontend && npm install && npm run dev
```

**Environment Variables:**
- `VITE_CLERK_PUBLISHABLE_KEY` - Your Clerk publishable key
- `CLERK_SECRET_KEY` - Your Clerk secret key (backend)

## Deployment

Deploys automatically to Render via `render.yaml` blueprint.

## Roadmap

- [x] Kanban UI with authentication
- [ ] PostgreSQL session persistence  
- [ ] Fly.io cloud sandbox integration
- [ ] Real-time session monitoring
- [ ] Test execution and validation