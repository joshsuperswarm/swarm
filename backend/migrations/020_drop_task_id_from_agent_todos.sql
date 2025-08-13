-- Drop task_id column from agent_todos table
-- The agent_todos table no longer needs to reference tasks directly

-- First, drop the foreign key constraint
ALTER TABLE agent_todos DROP CONSTRAINT agent_todos_task_id_fkey;

-- Drop the unique constraint that includes task_id
ALTER TABLE agent_todos DROP CONSTRAINT agent_todos_task_id_todo_id_key;

-- Drop the task_id column
ALTER TABLE agent_todos DROP COLUMN task_id;

-- Create a new unique constraint on just todo_id since it should be globally unique
ALTER TABLE agent_todos ADD CONSTRAINT agent_todos_todo_id_key UNIQUE (todo_id);