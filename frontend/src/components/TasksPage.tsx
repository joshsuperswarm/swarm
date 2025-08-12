import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useBackendJwtQuery } from '@/services/auth';
import { useNavigate } from 'react-router-dom';
import type { TaskWithRun } from '@/types';
import { createColumns } from '@/components/data-table/columns';
import { DataTable } from '@/components/data-table/data-table';
import { useAuth } from '@clerk/clerk-react';
import PricingScreen from '@/pages/PricingPage';
import { useTasksQuery, useUserProfileQuery, useCreateTaskMutation } from '@/services/queries';
import { ApiService, type RunMode } from '@/services/api';
import { useTaskHotkeys } from '@/hooks/useTaskHotkeys';
import { CreateTaskModal } from '@/components/CreateTaskModal';
import { useHotkeys } from 'react-hotkeys-hook';

// Memoize DataTable outside component to ensure stable reference
const MemoizedDataTable = React.memo(DataTable<TaskWithRun, unknown>); // default shallow compare

export function TasksPage() {
  const navigate = useNavigate();
  const { data: rawTasks = [], isFetching, error } = useTasksQuery();
  const { data: userProfile } = useUserProfileQuery();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isModalOpen, setModalOpen] = useState(false);
  const createTask = useCreateTaskMutation();
  const defaultRepo = userProfile?.default_repo ?? null;
  const { has, isLoaded } = useAuth();
  
  // Reverse the array so newest appears at top but j/k navigation works correctly
  const tasks = useMemo(() => [...rawTasks].reverse(), [rawTasks]);
  
  /* warm the cache for the first N tasks so detail pages feel instant */
  const qc = useQueryClient();
  const { data: jwt } = useBackendJwtQuery();
  
  // Keep selectedIndex within bounds when tasks change
  React.useEffect(() => {
    if (tasks.length > 0) {
      setSelectedIndex((prev) => Math.min(prev, tasks.length - 1));
    } else {
      setSelectedIndex(0);
    }
  }, [tasks]);

  // Derive selectedTask from selectedIndex
  const currentSelectedTask = useMemo(() => {
    return tasks.length > 0 ? tasks[selectedIndex] : null;
  }, [tasks, selectedIndex]);

  // Use custom hotkeys hook for j/k navigation
  useTaskHotkeys(tasks.length, selectedIndex, setSelectedIndex);

  // Memoize columns to prevent table re-initialization
  const columns = useMemo(() => {
    return createColumns();
  }, []);

  // Handle Enter key to navigate to task detail
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      // 1) Ignore when typing in common editable contexts
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;

      // 2) Ignore when pressed on buttons/links (e.g., modal submit button)
      const isButtonOrLink =
        target instanceof HTMLButtonElement ||
        target instanceof HTMLAnchorElement;

      // 3) Ignore if the event occurred within an open dialog/modal
      //    (we'll mark modal container with role="dialog" aria-modal="true")
      const inDialog = !!target?.closest('[role="dialog"], [aria-modal="true"]');

      if (isInput || isButtonOrLink || inDialog) return;

      if ((e.key === 'o' || e.key === 'Enter') && currentSelectedTask) {
        e.preventDefault();
        navigate(`/tasks/${currentSelectedTask.task_id}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSelectedTask, navigate]);

  // Global hotkeys for modal
  useHotkeys('esc', () => {
    if (isModalOpen) {
      setModalOpen(false);
    }
  }, {
    enabled: isModalOpen
  });

  // Create task with 'c' key
  useHotkeys('c', () => {
    setModalOpen(true);
  });

  // Prefetch cache warm-up effect
  useEffect(() => {
    if (!jwt || tasks.length === 0) return;

    const prefetchCount = 20; // <= tweak if desired
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
        queryFn: () =>
          ApiService.getTaskLogs(jwt, t.task_id).then((r) => r.logs),
        staleTime: Infinity,
      });
    });
  }, [tasks, jwt, qc]);

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  const hasValidPlan = has({ plan: 'free' }) || has({ plan: 'swarm_pro' });

  if (!hasValidPlan) {
    return <PricingScreen />;
  }

  // Handle task creation
  const handleCreateTask = async (taskData: {
    description: string;
    repositoryId: number | null;
    mode: RunMode;
  }) => {
    try {
      if (!taskData.repositoryId) {
        throw new Error('Repository is required');
      }
      
      await createTask.mutateAsync({
        description: taskData.description,
        repository_id: taskData.repositoryId,
        mode: taskData.mode,
      });
      setModalOpen(false);
      // Note: React Query will automatically invalidate and refetch tasks
    } catch (err) {
      console.error("Failed to create task:", err);
      // TODO: Show error notification to user
      setModalOpen(false);
    }
  };

  return (
    <div className="relative flex-1 min-w-0 overflow-hidden px-3 py-3 md:px-4 md:py-4 pb-24">
      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/80">
          <div className="text-center max-w-md">
            <div className="text-red-500 mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Failed to load tasks
            </h3>
            <p className="text-gray-600 mb-4">
              {error.message || 'An error occurred'}
            </p>
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
        <MemoizedDataTable
          data={tasks}
          columns={columns}
          loading={isFetching && tasks.length === 0}
          highlightedRow={String(currentSelectedTask?.task_id ?? '')}
        />
      </div>

      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onCreateTask={handleCreateTask}
        defaultRepository={defaultRepo}
      />
    </div>
  );
}
