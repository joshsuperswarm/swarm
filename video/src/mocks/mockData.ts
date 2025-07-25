// Real data structure matching the actual task from the screenshot
export const realTaskData = {
  task: {
    id: 56,
    title: "Implement chat architecture refactor: messages table, API endpoints, and frontend integration",
    description: "Refactor the existing chat system to use a proper messages table instead of storing chat data in task descriptions. This involves creating new database migrations, API endpoints for message CRUD operations, and updating the frontend to use the new chat architecture.\n\nKey requirements:\n- Create messages table with proper relationships\n- Implement GET/POST endpoints for messages\n- Update frontend components to use new API\n- Maintain backward compatibility during migration\n- Add proper error handling and validation",
    github_pr_url: "https://github.com/company/swarm/pull/123"
  },
  messages: [
    {
      run: {
        run: {
          status: "pr_opened"
        }
      }
    }
  ]
};

export const realTodos = [
  {
    todo_id: 1,
    content: "Add metadata column to messages table and create index [migration]",
    status: "completed",
    priority: "high",
    updated_at: "2025-07-23T17:45:27.000Z"
  },
  {
    todo_id: 2,
    content: "Implement GET /api/tasks/:id/messages endpoint",
    status: "completed", 
    priority: "high",
    updated_at: "2025-07-23T17:45:27.000Z"
  },
  {
    todo_id: 3,
    content: "Implement POST /api/tasks/:id/messages endpoint",
    status: "completed",
    priority: "high", 
    updated_at: "2025-07-23T17:45:28.000Z"
  },
  {
    todo_id: 4,
    content: "Update create_task handler to insert initial message",
    status: "completed",
    priority: "high",
    updated_at: "2025-07-23T17:45:28.000Z"
  },
  {
    todo_id: 5,
    content: "Add database access methods (get_task_messages, create_message, attach_run_to_message)",
    status: "completed",
    priority: "high",
    updated_at: "2025-07-23T17:45:28.000Z"
  },
  {
    todo_id: 6,
    content: "Update Run struct to export message_id with ts_rs",
    status: "completed",
    priority: "high",
    updated_at: "2025-07-23T17:45:28.000Z"
  },
  {
    todo_id: 7,
    content: "Add Message interface and API methods to frontend",
    status: "completed",
    priority: "high",
    updated_at: "2025-07-23T17:45:28.000Z"
  },
  {
    todo_id: 8,
    content: "Add React Query hooks for messages",
    status: "completed",
    priority: "high",
    updated_at: "2025-07-23T17:45:28.000Z"
  },
  {
    todo_id: 9,
    content: "Rewrite TaskChatPage.tsx to use real hooks",
    status: "completed",
    priority: "high",
    updated_at: "2025-07-23T17:45:28.000Z"
  },
  {
    todo_id: 10,
    content: "Delete mock files and add useRunMode helper",
    status: "completed",
    priority: "high",
    updated_at: "2025-07-23T17:45:28.000Z"
  }
];

export const statuses = [
  {
    value: "pr_opened",
    label: "PR Opened",
    icon: null
  }
];