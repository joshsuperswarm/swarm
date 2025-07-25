import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { Zap, FileText, Search, CheckCircle, Circle, Timer, XCircle, GitPullRequest } from 'lucide-react';
import type { TaskWithRun } from '../types/TaskWithRun';

// Mock data matching the real Swarm table from screenshot
const mockTasks: TaskWithRun[] = [
  {
    task_id: 56,
    title: "Implement chat architecture refactor: messages table, API endpoints, and frontend integrat...",
    status: "pr_opened",
    mode: "execute", 
    created_at: "2025-07-23T00:00:00Z",
    github_pr_url: "https://github.com/jmvldz/swarm/pull/123",
    latest_run: {
      id: 199,
      status: "completed",
      created_at: "2025-07-23T00:00:00Z"
    }
  },
  {
    task_id: 55,
    title: "Implement chat architecture refactor: messages table, API endpoints, and frontend integrat...",
    status: "failed",
    mode: "execute",
    created_at: "2025-07-23T00:00:00Z", 
    github_pr_url: null,
    latest_run: {
      id: 198,
      status: "failed",
      created_at: "2025-07-23T00:00:00Z"
    }
  },
  {
    task_id: 54,
    title: "Create empty file \"claude_was_here.txt\"",
    status: "pr_opened",
    mode: "execute",
    created_at: "2025-07-23T00:00:00Z",
    github_pr_url: "https://github.com/jmvldz/swarm/pull/124",
    latest_run: {
      id: 197,
      status: "completed", 
      created_at: "2025-07-23T00:00:00Z"
    }
  },
  {
    task_id: 53,
    title: "I don't see a task description in your message. Could you please provide the",
    status: "failed",
    mode: "execute",
    created_at: "2025-07-23T00:00:00Z",
    github_pr_url: null,
    latest_run: {
      id: 196,
      status: "failed",
      created_at: "2025-07-23T00:00:00Z"
    }
  },
  {
    task_id: 52,
    title: "Migrate tasks.description to first user message in messages table",
    status: "completed",
    mode: "execute",
    created_at: "2025-07-23T00:00:00Z",
    github_pr_url: null,
    latest_run: {
      id: 195,
      status: "completed",
      created_at: "2025-07-23T00:00:00Z"
    }
  },
  {
    task_id: 51,
    title: "Fix double database hit by removing redundant task ownership verification",
    status: "pr_opened",
    mode: "execute",
    created_at: "2025-07-22T00:00:00Z",
    github_pr_url: "https://github.com/jmvldz/swarm/pull/125",
    latest_run: {
      id: 194,
      status: "completed",
      created_at: "2025-07-22T00:00:00Z"
    }
  },
  {
    task_id: 50,
    title: "Ship atomic tasks+todos payload to eliminate todo loading spinners",
    status: "pr_opened",
    mode: "execute",
    created_at: "2025-07-22T00:00:00Z",
    github_pr_url: "https://github.com/jmvldz/swarm/pull/126",
    latest_run: {
      id: 193,
      status: "completed",
      created_at: "2025-07-22T00:00:00Z"
    }
  },
  {
    task_id: 49,
    title: "Investigate slow todo loading performance issue",
    status: "pr_opened",
    mode: "plan",
    created_at: "2025-07-22T00:00:00Z",
    github_pr_url: "https://github.com/jmvldz/swarm/pull/127",
    latest_run: {
      id: 192,
      status: "completed",
      created_at: "2025-07-22T00:00:00Z"
    }
  }
];

const getModeConfig = (mode: string | null) => {
  if (!mode) return { icon: Circle, label: '-', color: '#64748b' };
  
  switch (mode) {
    case 'execute':
      return { icon: Zap, label: 'Execute', color: '#059669' };
    case 'plan':
      return { icon: FileText, label: 'Plan', color: '#2563eb' };
    case 'review':
      return { icon: Search, label: 'Review', color: '#9333ea' };
    default:
      return { icon: Zap, label: mode, color: '#6b7280' };
  }
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'pending':
      return { icon: Circle, label: 'Pending', color: '#64748b' };
    case 'in_progress':
      return { icon: Timer, label: 'In Progress', color: '#f59e0b' };
    case 'completed':
      return { icon: CheckCircle, label: 'Done', color: '#059669' };
    case 'failed':
      return { icon: XCircle, label: 'Failed', color: '#dc2626' };
    case 'pr_opened':
      return { icon: GitPullRequest, label: 'PR Opened', color: '#3b82f6' };
    default:
      return { icon: Circle, label: status, color: '#64748b' };
  }
};

export function SimpleTaskTableForVideo() {
  const frame = useCurrentFrame();
  
  // Fade in animation
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div 
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        padding: "16px",
        opacity,
        background: "#ffffff",
        color: "#000000",
        minHeight: "100vh",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      <div style={{ 
        borderRadius: "8px",
        overflow: "hidden",
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f9fafb" }}>
            <tr>
              <th style={{ 
                padding: "12px 16px", 
                textAlign: "left", 
                fontSize: "14px", 
                fontWeight: 600, 
                color: "#374151",
                borderBottom: "1px solid #e5e7eb",
                width: "80px"
              }}>
                Task
              </th>
              <th style={{ 
                padding: "12px 16px", 
                textAlign: "left", 
                fontSize: "14px", 
                fontWeight: 600, 
                color: "#374151",
                borderBottom: "1px solid #e5e7eb",
                width: "100px"
              }}>
                Mode
              </th>
              <th style={{ 
                padding: "12px 16px", 
                textAlign: "left", 
                fontSize: "14px", 
                fontWeight: 600, 
                color: "#374151",
                borderBottom: "1px solid #e5e7eb"
              }}>
                Title
              </th>
              <th style={{ 
                padding: "12px 16px", 
                textAlign: "left", 
                fontSize: "14px", 
                fontWeight: 600, 
                color: "#374151",
                borderBottom: "1px solid #e5e7eb",
                width: "120px"
              }}>
                Status
              </th>
              <th style={{ 
                padding: "12px 16px", 
                textAlign: "left", 
                fontSize: "14px", 
                fontWeight: 600, 
                color: "#374151",
                borderBottom: "1px solid #e5e7eb",
                width: "100px"
              }}>
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {mockTasks.map((task, index) => {
              const modeConfig = getModeConfig(task.mode);
              const statusConfig = getStatusConfig(task.status);
              const isHighlighted = task.task_id === 56; // Highlight task 56
              const ModeIcon = modeConfig.icon;
              const StatusIcon = statusConfig.icon;
              
              return (
                <tr 
                  key={task.task_id} 
                  style={{ 
                    borderBottom: index < mockTasks.length - 1 ? "1px solid #e5e7eb" : "none",
                    background: isHighlighted ? "#f3f4f6" : "#ffffff",
                    transition: "background-color 0.15s ease"
                  }}
                >
                  <td style={{ padding: "12px 16px", fontSize: "14px", fontFamily: "SF Mono, Monaco, monospace", color: "#6b7280" }}>
                    {task.task_id}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <ModeIcon style={{ height: "16px", width: "16px", color: modeConfig.color }} />
                      <span style={{ fontSize: "14px", color: modeConfig.color, fontWeight: 500 }}>
                        {modeConfig.label}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ 
                      fontSize: "14px", 
                      fontWeight: 400,
                      color: "#111827",
                      maxWidth: "600px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "block"
                    }}>
                      {task.title}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <StatusIcon style={{ height: "16px", width: "16px", color: statusConfig.color }} />
                      <span style={{ 
                        fontSize: "14px", 
                        color: task.status === "pr_opened" && task.github_pr_url ? "#3b82f6" : statusConfig.color,
                        textDecoration: task.status === "pr_opened" && task.github_pr_url ? "none" : "none",
                        fontWeight: 500
                      }}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: "14px", color: "#6b7280" }}>
                      {task.created_at ? new Date(task.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '-'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}