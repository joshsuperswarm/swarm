// Real data structure matching the actual task from the screenshot
export const realTaskData = {
  task: {
    id: 56,
    title: "Create a Remotion video for Swarm",
    description: "Produce a high-impact Remotion video that showcases Swarm:\n– Intro with logo animation\n– Scene highlighting task creation flow\n– Plan / execute sequence with animated tables\n– Outro with call-to-action\nDeliver full-HD MP4 plus source code.",
    github_pr_url: "https://github.com/your-org/swarm-video/pull/1"
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
    content: "Set up Remotion project with TypeScript configuration",
    status: "completed",
    priority: "high",
    updated_at: "2025-07-25T17:45:27.000Z"
  },
  {
    todo_id: 2,
    content: "Create logo animation component with spring physics",
    status: "completed", 
    priority: "high",
    updated_at: "2025-07-25T17:45:27.000Z"
  },
  {
    todo_id: 3,
    content: "Build task creation scene with typing animation",
    status: "completed",
    priority: "high", 
    updated_at: "2025-07-25T17:45:28.000Z"
  },
  {
    todo_id: 4,
    content: "Implement plan execution scene with animated transitions",
    status: "in_progress",
    priority: "high",
    updated_at: "2025-07-25T17:45:28.000Z"
  },
  {
    todo_id: 5,
    content: "Add background gradients and color theming",
    status: "pending",
    priority: "medium",
    updated_at: "2025-07-25T17:45:28.000Z"
  }
];

export const statuses = [
  {
    value: "pr_opened",
    label: "PR Opened",
    icon: null
  }
];