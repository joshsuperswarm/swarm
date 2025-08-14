-- Consolidate plan and review modes into chat mode
-- Update existing plan and review runs to chat mode
UPDATE runs SET mode = 'chat' WHERE mode IN ('plan', 'review');

-- Update any existing messages that reference plan or review modes  
-- This is mainly for any comments/artifacts table if they exist
-- Since comments table was renamed to messages, update messages if needed
UPDATE messages SET metadata = jsonb_set(
    COALESCE(metadata, '{}'),
    '{mode}',
    '"chat"'
) WHERE metadata->>'mode' IN ('plan', 'review');