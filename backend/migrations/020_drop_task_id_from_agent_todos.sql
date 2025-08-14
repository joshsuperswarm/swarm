-- Replace task_id with run_id in agent_todos table
-- Agent todos should be unique per run, not globally unique

-- First, drop the foreign key constraint
ALTER TABLE agent_todos DROP CONSTRAINT agent_todos_task_id_fkey;

-- Drop the unique constraint that includes task_id
ALTER TABLE agent_todos DROP CONSTRAINT agent_todos_task_id_todo_id_key;

-- Rename task_id column to run_id
ALTER TABLE agent_todos RENAME COLUMN task_id TO run_id;

-- Add foreign key constraint to runs table
ALTER TABLE agent_todos ADD CONSTRAINT agent_todos_run_id_fkey 
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE;

-- Create unique constraint on (run_id, todo_id)
ALTER TABLE agent_todos ADD CONSTRAINT agent_todos_run_id_todo_id_key 
    UNIQUE (run_id, todo_id);