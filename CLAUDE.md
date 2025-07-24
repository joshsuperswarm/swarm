1. You should never modify the code in frontend/src/types/generated/
2. Check your environment using `uname`
3. If you need to update the generated Typescript types, you need to make sure the Rust model is imported in main.rs. Then run `cargo build` on the backend to generate.
4. If your environment is Mac OS, then use the docker compose file for the instructions to connect to Postgres. If you're on Linux, then use the Modal instructions below.

## Modal Sandbox Database Access

When working in a Modal sandbox environment, PostgreSQL is automatically configured and running. To connect to the database:

### PostgreSQL Connection in Modal Sandboxes

```bash
# Connect via Unix socket (recommended)
psql -h /tmp swarm

# Or connect via TCP
psql -h localhost -p 5432 swarm

# Database connection details:
# - Host: /tmp (socket) or localhost (TCP)
# - Port: 5432
# - Database: swarm
# - User: swarm
# - No password required (trust authentication)
```

**Note**: The PostgreSQL socket is located in `/tmp` instead of the default `/var/run/postgresql/` for proper permissions in the containerized environment.

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
