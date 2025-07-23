SELECT at.todo_id, at.content, at.priority, at.status, at.updated_at
FROM agent_todos at
JOIN tasks t ON at.task_id = t.id
WHERE at.task_id = $1 AND t.user_id = $2
ORDER BY at.updated_at