CREATE TABLE agent_todos (
    id           SERIAL PRIMARY KEY,
    task_id      INTEGER    NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    todo_id      TEXT       NOT NULL,              -- the 'id' from Claude
    content      TEXT       NOT NULL,
    priority     TEXT       NOT NULL,              -- high | medium | low
    status       TEXT       NOT NULL,              -- pending | in_progress | completed
    updated_at   TIMESTAMPTZ DEFAULT now(),
    UNIQUE(task_id, todo_id)
);