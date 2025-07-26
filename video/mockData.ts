// Mock data for Swarm video demonstration
export const mockTasks = [
  {
    task_id: 1,
    title: "Implement user authentication system",
    description: "Set up JWT-based authentication with email/password login, including middleware for protected routes and user session management. Need to integrate with existing database schema and add proper error handling.",
    status: "running",
    mode: "execute",
    created_at: "2024-01-15T09:30:00Z",
    github_pr_url: null
  },
  {
    task_id: 2,
    title: "Fix memory leak in WebSocket connections",
    description: "Investigate and resolve memory leak occurring in WebSocket handler. Users report connection drops after extended sessions. Review connection pooling and cleanup logic.",
    status: "done",
    mode: "execute",
    created_at: "2024-01-15T08:45:00Z",
    github_pr_url: "https://github.com/company/app/pull/847"
  },
  {
    task_id: 3,
    title: "Add dark mode support to dashboard",
    description: "Implement comprehensive dark mode theme across the entire dashboard interface. Include theme toggle, proper contrast ratios, and persistence of user preference. Update all components to support both themes.",
    status: "pr_opened",
    mode: "execute",
    created_at: "2024-01-15T07:20:00Z",
    github_pr_url: "https://github.com/company/app/pull/851"
  },
  {
    task_id: 4,
    title: "Optimize database queries for analytics page",
    description: "The analytics dashboard is loading slowly due to inefficient database queries. Need to add proper indexing, implement query optimization, and consider caching for frequently accessed data.",
    status: "spinning",
    mode: "execute",
    created_at: "2024-01-15T06:15:00Z",
    github_pr_url: null
  },
  {
    task_id: 5,
    title: "Review security vulnerability in API endpoint",
    description: "Security audit revealed potential SQL injection vulnerability in /api/users/search endpoint. Need to review input validation and implement proper parameterized queries.",
    status: "failed",
    mode: "review",
    created_at: "2024-01-14T16:30:00Z",
    github_pr_url: null
  },
  {
    task_id: 6,
    title: "Plan microservices architecture migration",
    description: "Create detailed migration plan for breaking down monolithic application into microservices. Include service boundaries, data migration strategy, and deployment considerations.",
    status: "done",
    mode: "plan",
    created_at: "2024-01-14T14:20:00Z",
    github_pr_url: null
  }
];

export const mockTodos = [
  {
    id: "1",
    content: "Set up JWT token generation and validation middleware",
    status: "completed",
    priority: "high"
  },
  {
    id: "2", 
    content: "Create user registration endpoint with email validation",
    status: "completed",
    priority: "high"
  },
  {
    id: "3",
    content: "Implement password hashing with bcrypt",
    status: "in_progress",
    priority: "high"
  },
  {
    id: "4",
    content: "Add rate limiting to authentication endpoints",
    status: "pending",
    priority: "medium"
  },
  {
    id: "5",
    content: "Write comprehensive unit tests for auth system",
    status: "pending",
    priority: "medium"
  },
  {
    id: "6",
    content: "Update API documentation with new auth endpoints",
    status: "pending",
    priority: "low"
  }
];

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

export const taskDetail = {
  task: {
    id: 1,
    title: "Implement user authentication system",
    description: "Set up JWT-based authentication with email/password login, including middleware for protected routes and user session management. Need to integrate with existing database schema and add proper error handling.\n\nRequirements:\n- JWT token generation and validation\n- Password hashing with bcrypt\n- User registration with email validation\n- Login endpoint with proper error handling\n- Middleware for protecting routes\n- Rate limiting on auth endpoints\n- Comprehensive testing\n- API documentation updates\n\nAcceptance Criteria:\n- Users can register with email/password\n- Users can login and receive JWT token\n- Protected routes require valid JWT\n- Passwords are securely hashed\n- Rate limiting prevents brute force attacks\n- All tests pass\n- Documentation is updated",
    github_pr_url: null
  },
  messages: [
    {
      run: {
        run: {
          status: "running"
        }
      }
    }
  ]
};