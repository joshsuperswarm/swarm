-- Complete database schema for Swarm
-- Users table to store Clerk user data with GitHub information
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    clerk_user_id VARCHAR(255) NOT NULL UNIQUE,
    github_username VARCHAR(255),
    github_user_id INTEGER,
    email VARCHAR(255),
    default_repo_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Repositories table to store user's GitHub repositories
CREATE TABLE repositories (
    id SERIAL PRIMARY KEY,
    github_repo_id BIGINT NOT NULL,
    owner VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_private BOOLEAN DEFAULT FALSE,
    last_fetched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(github_repo_id, user_id)
);

-- GitHub tokens table to store OAuth access tokens
CREATE TABLE github_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    token_type VARCHAR(50) DEFAULT 'bearer',
    scope TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Tasks table for AI agent tasks
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    github_pr_url VARCHAR(500),
    github_branch VARCHAR(255),
    commit_title TEXT,
    commit_body TEXT,
    pr_title TEXT,
    pr_body TEXT,
    sandbox_id TEXT,
    session_id TEXT,
    command_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task logs table for storing task execution logs
CREATE TABLE task_logs (
    id BIGSERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    log_line JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent todos table for tracking AI agent task progress
CREATE TABLE agent_todos (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    todo_id TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(task_id, todo_id)
);

-- Add foreign key constraint for default_repo_id
ALTER TABLE users ADD CONSTRAINT fk_users_default_repo 
    FOREIGN KEY (default_repo_id) REFERENCES repositories(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX idx_users_clerk_user_id ON users(clerk_user_id);
CREATE INDEX idx_repositories_user_id ON repositories(user_id);
CREATE INDEX idx_repositories_github_repo_id ON repositories(github_repo_id);
CREATE INDEX idx_repositories_last_fetched_at ON repositories(last_fetched_at);
CREATE INDEX idx_github_tokens_user_id ON github_tokens(user_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_github_branch ON tasks(github_branch);
CREATE INDEX idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX idx_task_logs_task_id_id ON task_logs(task_id, id);