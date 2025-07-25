import React, { useMemo } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { DataTableForVideo } from "./DataTableForVideo";
import { createColumnsForVideo } from "./ColumnsForVideo";
import type { TaskWithRun } from "../types/TaskWithRun";

// Mock data for the video - showing multiple tasks
const mockTasks: TaskWithRun[] = [
  {
    task_id: 58,
    title: "Update React component state management patterns",
    status: "completed",
    mode: "execute",
    created_at: "2024-12-20T10:30:00Z",
    github_pr_url: null,
    latest_run: {
      id: 201,
      status: "completed",
      created_at: "2024-12-20T10:30:00Z"
    }
  },
  {
    task_id: 57,
    title: "Fix TypeScript compilation errors in components",
    status: "in_progress", 
    mode: "plan",
    created_at: "2024-12-20T09:15:00Z",
    github_pr_url: null,
    latest_run: {
      id: 200,
      status: "running",
      created_at: "2024-12-20T09:15:00Z"
    }
  },
  {
    task_id: 56,
    title: "Refactor chat architecture to improve message handling",
    status: "pr_opened",
    mode: "execute", 
    created_at: "2024-12-19T16:45:00Z",
    github_pr_url: "https://github.com/jmvldz/swarm/pull/123",
    latest_run: {
      id: 199,
      status: "completed",
      created_at: "2024-12-19T16:45:00Z"
    }
  },
  {
    task_id: 55,
    title: "Implement user authentication middleware",
    status: "pending",
    mode: "review",
    created_at: "2024-12-19T14:20:00Z", 
    github_pr_url: null,
    latest_run: null
  },
  {
    task_id: 54,
    title: "Optimize database query performance for large datasets",
    status: "failed",
    mode: "execute",
    created_at: "2024-12-19T11:30:00Z",
    github_pr_url: null,
    latest_run: {
      id: 197,
      status: "failed", 
      created_at: "2024-12-19T11:30:00Z"
    }
  }
];

interface TasksPageForVideoProps {
  // No props needed for the video version
}

export function TasksPageForVideo({}: TasksPageForVideoProps) {
  const frame = useCurrentFrame();
  
  // Fade in animation
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Memoize columns to prevent re-initialization
  const columns = useMemo(() => {
    return createColumnsForVideo();
  }, []);

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
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
        color: "#e2e8f0",
        minHeight: "100vh"
      }}
    >
      {/* Main content */}
      <div 
        style={{
          flex: 1,
          minWidth: 0
        }}
      >
        <DataTableForVideo
          data={mockTasks}
          columns={columns}
          loading={false}
          highlightedRow={String(mockTasks[2]?.task_id ?? '')} // Highlight task 56
        />
      </div>
    </div>
  );
}