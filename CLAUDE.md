# Swarm - AI Agent Task Manager

## Overview
Swarm is a task management system where users create tasks assigned to AI agents that automatically work on GitHub repositories. Users log in with GitHub, select repositories, and AI agents execute tasks autonomously with results delivered via GitHub PRs.

## Architecture
- **Backend**: Rust + Axum web server with Clerk JWT authentication + PostgreSQL
- **Frontend**: React + TypeScript + Vite with Tailwind CSS
- **Database**: PostgreSQL (Docker for local development)
- **Authentication**: Clerk with GitHub OAuth (required)
- **Deployment**: Render (backend service + frontend static site)

## Key Commands

### Quick Setup
```bash
# Start PostgreSQL
docker-compose up -d

# Run backend (connects to PostgreSQL, runs migrations)
cd backend && cargo run

# Run frontend  
cd frontend && bun install && bun run dev
```

### Backend (Rust)
```bash
cd backend
cp .env.example .env    # Copy environment template (first time only)
cargo run               # Development server (loads .env automatically)
cargo build --release  # Production build
cargo check             # Type/compile check
```

### Frontend (React/TypeScript)
```bash
cd frontend
bun install        # Install dependencies
bun run dev        # Development server (localhost:5173)
bun run build      # Production build (includes TypeScript compilation)
bun run lint       # ESLint
```

### Database Management
```bash
docker-compose up -d    # Start PostgreSQL container
docker-compose down     # Stop PostgreSQL
docker-compose down -v  # Reset database (deletes all data)
```

### Development Workflow
- **Database**: PostgreSQL in Docker container (one command setup)
- **Real persistence**: Users, repositories, and tasks stored in database
- **GitHub integration**: Ready for GitHub OAuth and repository access
- **Git Hook**: Pre-commit hook runs both `cargo check` and `bun run build`
- **Linting**: Run `bun run lint` in frontend before commits
- **Logging**: Console logs use unicode characters (✓ ✗ ⚠ →) instead of emojis for clean output

## Project Structure
```
backend/src/
├── main.rs              # Axum server with PostgreSQL and auth
├── clerk_middleware.rs  # JWT authentication middleware  
├── database_working.rs  # PostgreSQL database operations
├── models.rs           # Database models (User, Repository, Task)
└── migrations/         # Database schema migrations

frontend/src/
├── components/          # React components (TasksPage, CreateTaskModal, etc.)
├── store/              # Zustand state management
└── types/              # TypeScript interfaces

docker-compose.yml      # PostgreSQL setup for local development
landing/                # Next.js marketing site
```

## Important Files
- `docker-compose.yml` - PostgreSQL container setup
- `backend/migrations/001_initial_schema.sql` - Database schema
- `frontend/package.json` - Build scripts and dependencies  
- `backend/Cargo.toml` - Rust dependencies with PostgreSQL
- `.env.example` - Environment variable template

## API Endpoints
- `GET /health` - Health check
- `GET /api/user/profile` - User profile with GitHub data
- `GET /api/user/repos` - User's GitHub repositories
- `POST /api/user/default-repo` - Set default repository
- `GET /api/tasks` - User's tasks
- `POST /api/tasks` - Create new task

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection (default: Docker container)
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk auth (frontend)  
- `CLERK_SECRET_KEY` - Clerk auth (backend)
- `VITE_API_URL` - Backend URL

## Current Status
- ✓ PostgreSQL database integration working
- ✓ Real user management and authentication
- ✓ Task creation interface with repository selection
- ✓ GitHub OAuth UI (ready for Clerk GitHub provider)
- ✓ Professional task management interface
- ✓ Production-ready database setup

## Workflow
1. User logs in with GitHub (Clerk OAuth)
2. User creates task via "Create Task" button  
3. User selects GitHub repository from dropdown
4. Backend stores task and will trigger AI agent execution
5. AI agent works autonomously on repository
6. Changes pushed to GitHub PR for review