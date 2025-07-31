import type { Task, Todo, TaskDetails } from '../types';

// Unified mock tasks
export const mockTasks: Task[] = [
  {
    id: 56,
    task_id: 56,
    title: "Create a Remotion video for Swarm",
    description: "Produce a high-impact Remotion video that showcases Swarm:\n– Intro with logo animation\n– Scene highlighting task creation flow\n– Plan / execute sequence with animated tables\n– Outro with call-to-action\nDeliver full-HD MP4 plus source code.",
    status: "pr_opened",
    mode: "execute",
    created_at: "2025-07-25T17:45:27.000Z",
    github_pr_url: "https://github.com/your-org/swarm-video/pull/1",
    latest_run: {
      id: 1,
      status: "pr_opened",
      created_at: "2025-07-25T17:45:27.000Z"
    }
  },
  {
    id: 1,
    task_id: 1,
    title: "Implement user authentication system",
    description: "Set up JWT-based authentication with email/password login, including middleware for protected routes and user session management. Need to integrate with existing database schema and add proper error handling.",
    status: "running",
    mode: "execute",
    created_at: "2024-01-15T09:30:00Z",
    github_pr_url: null
  },
  {
    id: 2,
    task_id: 2,
    title: "Fix memory leak in WebSocket connections",
    description: "Investigate and resolve memory leak occurring in WebSocket handler. Users report connection drops after extended sessions. Review connection pooling and cleanup logic.",
    status: "done",
    mode: "execute",
    created_at: "2024-01-15T08:45:00Z",
    github_pr_url: "https://github.com/company/app/pull/847"
  },
  {
    id: 3,
    task_id: 3,
    title: "Add dark mode support to dashboard",
    description: "Implement comprehensive dark mode theme across the entire dashboard interface. Include theme toggle, proper contrast ratios, and persistence of user preference. Update all components to support both themes.",
    status: "pr_opened",
    mode: "execute",
    created_at: "2024-01-15T07:20:00Z",
    github_pr_url: "https://github.com/company/app/pull/851"
  },
  {
    id: 4,
    task_id: 4,
    title: "Optimize database queries for analytics page",
    description: "The analytics dashboard is loading slowly due to inefficient database queries. Need to add proper indexing, implement query optimization, and consider caching for frequently accessed data.",
    status: "spinning",
    mode: "execute",
    created_at: "2024-01-15T06:15:00Z",
    github_pr_url: null
  },
  {
    id: 5,
    task_id: 5,
    title: "Review security vulnerability in API endpoint",
    description: "Security audit revealed potential SQL injection vulnerability in /api/users/search endpoint. Need to review input validation and implement proper parameterized queries.",
    status: "failed",
    mode: "review",
    created_at: "2024-01-14T16:30:00Z",
    github_pr_url: null
  },
  {
    id: 6,
    task_id: 6,
    title: "Plan microservices architecture migration",
    description: "Create detailed migration plan for breaking down monolithic application into microservices. Include service boundaries, data migration strategy, and deployment considerations.",
    status: "done",
    mode: "plan",
    created_at: "2024-01-14T14:20:00Z",
    github_pr_url: null
  }
];

// Unified mock todos
export const mockTodos: Todo[] = [
  {
    id: "1",
    todo_id: 1,
    content: "Set up Remotion project with TypeScript configuration",
    status: "completed",
    priority: "high",
    updated_at: "2025-07-25T17:45:27.000Z"
  },
  {
    id: "2",
    todo_id: 2,
    content: "Create logo animation component with spring physics",
    status: "completed", 
    priority: "high",
    updated_at: "2025-07-25T17:45:27.000Z"
  },
  {
    id: "3",
    todo_id: 3,
    content: "Build task creation scene with typing animation",
    status: "completed",
    priority: "high", 
    updated_at: "2025-07-25T17:45:28.000Z"
  },
  {
    id: "4",
    todo_id: 4,
    content: "Implement plan execution scene with animated transitions",
    status: "in_progress",
    priority: "high",
    updated_at: "2025-07-25T17:45:28.000Z"
  },
  {
    id: "5",
    todo_id: 5,
    content: "Add background gradients and color theming",
    status: "pending",
    priority: "medium",
    updated_at: "2025-07-25T17:45:28.000Z"
  },
  {
    id: "6",
    content: "Set up JWT token generation and validation middleware",
    status: "completed",
    priority: "high"
  },
  {
    id: "7", 
    content: "Create user registration endpoint with email validation",
    status: "completed",
    priority: "high"
  },
  {
    id: "8",
    content: "Implement password hashing with bcrypt",
    status: "in_progress",
    priority: "high"
  },
  {
    id: "9",
    content: "Add rate limiting to authentication endpoints",
    status: "pending",
    priority: "medium"
  },
  {
    id: "10",
    content: "Write comprehensive unit tests for auth system",
    status: "pending",
    priority: "medium"
  },
  {
    id: "11",
    content: "Update API documentation with new auth endpoints",
    status: "pending",
    priority: "low"
  }
];

// Mock logs
export const mockLogs = [
  "[09:45:23] 🔧 Starting authentication system implementation...",
  "[09:45:24] Installing required dependencies: jsonwebtoken, bcryptjs",
  "[09:45:28] Dependencies installed successfully",
  "[09:45:30] Creating auth middleware in src/middleware/auth.ts",
  "[09:45:35] JWT middleware created with token validation",
  "[09:45:40] Setting up password hashing utilities",
  "[09:45:45] Bcrypt integration complete",
  "[09:45:50] Creating user registration endpoint",
  "[09:46:15] Registration endpoint with email validation ready",
  "[09:46:20] Implementing login endpoint with JWT generation",
  "[09:46:45] Warning: Rate limiting not yet implemented",
  "[09:46:50] Running authentication flow tests...",
  "[09:47:10] All authentication tests passing",
  "[09:47:15] Updating API documentation...",
  "[09:47:25] Authentication system implementation in progress..."
];

// Task detail structure
export const taskDetail: TaskDetails = {
  task: mockTasks[0]!, // Main Remotion video task
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

// Plan items for scenes
export const planItems = [
  'Storyboard key scenes (intro, create task, plan, outro)',
  'Build React components for each scene',
  'Animate with Remotion interpolate & spring',
  'Add gradients, typography, and on-brand colors',
];

// Placeholder words for planning animations
export const placeholderWords = ['Pondering', 'Analyzing', 'Perusing', 'Planning'] as const;