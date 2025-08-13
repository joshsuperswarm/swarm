-- Add model column to runs table with default 'sonnet'
ALTER TABLE runs ADD COLUMN model VARCHAR(10) NOT NULL DEFAULT 'sonnet';

-- Add CHECK constraint to only allow 'sonnet' or 'opus' values
ALTER TABLE runs ADD CONSTRAINT runs_model_check CHECK (model IN ('sonnet', 'opus'));

-- Add index on model column for performance
CREATE INDEX idx_runs_model ON runs(model);