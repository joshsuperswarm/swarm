# Swarm - AI Agent Session Manager

## Overview
Swarm is a cloud session manager for AI coding agents (Claude Code, Codex, Gemini CLI). It provides a chat interface to track and manage AI agent sessions with authentication and cloud sandbox environments.

## Architecture
- **Backend**: Rust + Axum web server with Clerk JWT authentication
- **Frontend**: React + TypeScript + Vite with Tailwind CSS
- **Landing**: Next.js marketing site
- **Deployment**: Render (backend service + frontend static site)

## Key Commands

### Backend (Rust)
```bash
cd backend
cargo run          # Development server
cargo build --release  # Production build
cargo check        # Type/compile check
```

### Frontend (React/TypeScript)
```bash
cd frontend
npm install        # Install dependencies
npm run dev        # Development server (localhost:5173)
npm run build      # Production build (includes TypeScript compilation)
npm run lint       # ESLint
```

### Development Workflow
- **Git Hook**: Pre-commit hook runs both `cargo check` and `npm run build` to prevent compilation errors
- **Testing**: No formal tests yet - add unit tests for components and API endpoints
- **Linting**: Run `npm run lint` in frontend before commits

## Project Structure
```
backend/src/
├── main.rs              # Axum server with CORS and auth
└── clerk_middleware.rs  # JWT authentication middleware

frontend/src/
├── components/          # React components (ChatView, MessageList, etc.)
├── store/              # Zustand state management
└── types/              # TypeScript interfaces

landing/                # Next.js marketing site
```

## Important Files
- `render.yaml` - Deployment configuration
- `frontend/package.json` - Build scripts and dependencies  
- `backend/Cargo.toml` - Rust dependencies
- `.git/hooks/pre-commit` - Compilation checks before commits

## API Endpoints
- `GET /health` - Health check (required for Render)
- Protected routes use Clerk JWT authentication

## Environment Variables
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk auth (frontend)
- `CLERK_SECRET_KEY` - Clerk auth (backend)
- `VITE_API_URL` - Backend URL

## Current Status
- Chat interface implemented (replaced original Kanban design)
- Authentication working with Clerk
- Using mock data for development
- Ready for API integration between frontend and backend