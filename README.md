# Swarm - AI Agent Task Manager

A task management system where users can create tasks assigned to AI agents that automatically work on GitHub repositories.

## Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) (18+)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd swarm
   ```

2. **Start the PostgreSQL database**
   ```bash
   docker-compose up -d
   ```
   This starts a PostgreSQL container on port 5432 with:
   - Database: `swarm`
   - Username: `swarm`
   - Password: `password`

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Clerk keys
   ```

4. **Run the backend**
   ```bash
   cd backend
   cargo run
   ```
   The backend will:
   - Connect to PostgreSQL at `localhost:5432`
   - Run database migrations automatically
   - Start the API server on `localhost:3001`

5. **Run the frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Frontend available at `localhost:5173`

### Database Management

```bash
# Start database
docker-compose up -d

# Stop database
docker-compose down

# Reset database (deletes all data)
docker-compose down -v && docker-compose up -d

# View database logs
docker-compose logs postgres
```

## Architecture

- **Backend**: Rust + Axum web server with Clerk JWT authentication
- **Frontend**: React + TypeScript + Vite with Tailwind CSS
- **Database**: PostgreSQL (Docker for local development)
- **Authentication**: Clerk with GitHub OAuth

## Key Features

- GitHub OAuth authentication (required)
- Repository selection for task creation
- AI agent task management
- Real-time task status tracking
- Automatic PR creation for completed tasks
- Vim-style keyboard navigation

## Keyboard Shortcuts

### Task Table Navigation
- **j** - Move selection down one row
- **k** - Move selection up one row  
- **o** or **Enter** - Open selected task details modal

### Task Detail Modal
- **j** - Jump to next task (wraps around)
- **k** - Jump to previous task (wraps around)

*Note: Keyboard shortcuts are disabled while typing in input fields or text areas.*

## Development Workflow

1. User logs in with GitHub (Clerk handles OAuth)
2. User creates task via "Create Task" button
3. User selects GitHub repository from their accessible repos
4. Backend creates task and will trigger sandbox execution
5. AI agent works autonomously on the repository
6. Changes pushed to GitHub PR for review

## Environment Variables

### Backend
- `DATABASE_URL` - PostgreSQL connection string (default: docker compose)
- `CLERK_SECRET_KEY` - Clerk secret key for JWT validation
- `PORT` - Server port (default: 3001)

### Frontend
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `VITE_API_URL` - Backend API URL (default: http://localhost:3001)

## Production Deployment

1. Set up managed PostgreSQL database
2. Configure Clerk with GitHub OAuth app
3. Deploy backend as web service
4. Deploy frontend as static site
5. Set production environment variables