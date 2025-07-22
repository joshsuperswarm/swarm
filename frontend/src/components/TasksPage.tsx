import React, {
  useState,
  useMemo,
  useEffect,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useQueryClient } from "@tanstack/react-query";
import { useBackendJwtQuery } from "@/services/auth";
import { useNavigate } from "react-router-dom";
import type { TaskWithRun } from "@/types";
import { createColumns } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { useTasksQuery } from "@/services/queries";
import { ApiService } from "@/services/api";


// Memoize DataTable outside component to ensure stable reference
const MemoizedDataTable = React.memo(DataTable<TaskWithRun, unknown>); // default shallow compare

// Key filter to ignore hotkeys when user is typing or interacting with UI elements
const keyFilter = (keyboardEvent: KeyboardEvent) => {
  const target = keyboardEvent.target as HTMLElement;
  const tagName = target.tagName.toLowerCase();
  const isContentEditable = target.contentEditable === "true";
  return !(tagName === "input" || tagName === "textarea" || tagName === "button" || isContentEditable);
};

export function TasksPage() {
  // console.log('🔄 TasksPage render')
  const navigate = useNavigate();
  const { data: tasks = [], isFetching, error } = useTasksQuery();
  const [selectedIndex, setSelectedIndex] = useState(0);

  /* ✨ warm the cache for the first N tasks so detail pages feel instant */
  const qc = useQueryClient();
  const { data: jwt } = useBackendJwtQuery();

  useEffect(() => {
    if (!jwt || tasks.length === 0) return;

    const prefetchCount = 20;                // <= tweak if desired
    tasks.slice(0, prefetchCount).forEach((t) => {
      // prime simple task lookup
      qc.setQueryData(['task', t.task_id], t);

      // prefetch todos + logs in background (non‑blocking)
      qc.prefetchQuery({
        queryKey: ['task-todos', t.task_id],
        queryFn: () => ApiService.getTaskTodos(jwt, t.task_id),
        staleTime: 5 * 60 * 1000,
      });
      qc.prefetchQuery({
        queryKey: ['task-logs', t.task_id],
        queryFn: () => ApiService.getTaskLogs(jwt, t.task_id).then(r => r.logs),
        staleTime: Infinity,
      });
    });
  }, [tasks, jwt, qc]);

  // Keep selectedIndex within bounds when tasks change
  React.useEffect(() => {
    if (tasks.length > 0) {
      setSelectedIndex(prev => Math.min(prev, tasks.length - 1));
    } else {
      setSelectedIndex(0);
    }
  }, [tasks]);

  // Derive selectedTask from selectedIndex
  const currentSelectedTask = useMemo(() => {
    return tasks.length > 0 ? tasks[selectedIndex] : null;
  }, [tasks, selectedIndex]);

  // Keyboard navigation hotkeys for table
  useHotkeys('j', () => {
    setSelectedIndex(i => Math.min(i + 1, tasks.length - 1));
  }, {
    ignoreEventWhen: (e) => !keyFilter(e),
    enabled: tasks.length > 0
  });

  useHotkeys('k', () => {
    setSelectedIndex(i => Math.max(i - 1, 0));
  }, {
    ignoreEventWhen: (e) => !keyFilter(e),
    enabled: tasks.length > 0
  });

  useHotkeys(['o', 'enter'], () => {
    if (currentSelectedTask) {
      navigate(`/tasks/${currentSelectedTask.task_id}`);
    }
  }, {
    ignoreEventWhen: (e) => !keyFilter(e),
    enabled: tasks.length > 0
  });

  // Memoize columns to prevent table re-initialization
  const columns = useMemo(() => {
    // console.log('🔄 TasksPage columns recreated')
    return createColumns();
  }, []);

  return (
    <div className="relative flex-1 min-w-0 overflow-hidden px-0 py-4 sm:px-6">
      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/80">
          <div className="text-center max-w-md">
            <div className="text-red-500 mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Failed to load tasks
            </h3>
            <p className="text-gray-600 mb-4">{error.message || 'An error occurred'}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Tasks</h1>
        </div>
        <MemoizedDataTable
          data={tasks}
          columns={columns}
          loading={isFetching && tasks.length === 0}
          highlightedRow={String(currentSelectedTask?.task_id ?? '')}
        />
      </div>
    </div>
  );
}
