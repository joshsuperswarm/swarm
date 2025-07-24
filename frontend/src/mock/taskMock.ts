export const mockTask = {
  task_id: 42,
  title: "Implement dark-mode switch",
  description: "Add a toggle so users can enable dark mode.",
  status: "running",      // or "done" / "failed" / "pr_opened"
  github_pr_url: null,
};

export const mockConversation: Array<{
  id: string;
  side: "left" | "right";
  content: string;
  timestamp: string;
  showCollapsedTodos?: boolean;
  showTodos?: boolean;
  logs?: string[];
}> = [
  {
    id: "user-1",
    side: "left" as const,
    content: "Add a toggle so users can enable dark mode.",
    timestamp: "2024-01-15T10:00:00Z"
  },
  {
    id: "agent-1", 
    side: "right" as const,
    content: "I'll help you implement a dark mode toggle. Let me break this down into steps and get started.",
    timestamp: "2024-01-15T10:00:30Z",
    showCollapsedTodos: true,
    logs: [
      '{"level":"info","msg":"analyzing codebase structure"}',
      '{"level":"info","msg":"found existing theme setup"}',
      '{"level":"info","msg":"planning dark mode implementation"}'
    ]
  },
  {
    id: "user-2",
    side: "left" as const,
    content: "How's the progress going?",
    timestamp: "2024-01-15T10:05:00Z"
  },
  {
    id: "agent-2",
    side: "right" as const,
    content: "Currently working on the implementation. Here's what I'm doing:",
    timestamp: "2024-01-15T10:05:15Z",
    showTodos: true,
    logs: [
      '{"level":"info","msg":"creating toggle component"}',
      '{"level":"info","msg":"setting up context provider"}',
      '{"level":"info","msg":"adding CSS variables for themes"}',
      '{"level":"warn","msg":"found conflicting styles in Button component"}'
    ]
  }
];

export const mockTodos = [
  { todo_id: "t1", content: "Create toggle button", status: "completed", updated_at: null, priority: "med" },
  { todo_id: "t2", content: "Wire up context provider", status: "in_progress", updated_at: null, priority: "med" },
  { todo_id: "t3", content: "Add Tailwind dark classes", status: "pending", updated_at: null, priority: "low" },
];

export const mockLogs = [
  '{"level":"info","msg":"starting dark-mode branch"}',
  '{"level":"info","msg":"installing deps"}',
  '{"level":"info","msg":"running tests"}',
];