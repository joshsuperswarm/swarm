import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useBackendJwtQuery } from '@/services/auth';
import { useNavigate } from 'react-router-dom';
import type { TaskWithRun } from '@/types';
import { createColumns } from '@/components/data-table/columns';
import { DataTable } from '@/components/data-table/data-table';
import { useAuth } from '@clerk/clerk-react';
import PricingScreen from '@/pages/PricingPage';
import { useTasksQuery, useArchiveTaskMutation, useArchiveMultipleTasksMutation } from '@/services/queries';
import { ApiService } from '@/services/api';
import { useTaskHotkeys } from '@/hooks/useTaskHotkeys';
import { useModalStore } from '@/store/modalStore';
import { useTaskSelectionStore } from '@/store/taskSelectionStore';
import { useHotkeys } from 'react-hotkeys-hook';

// Memoize DataTable outside component to ensure stable reference
const MemoizedDataTable = React.memo(DataTable<TaskWithRun, unknown>); // default shallow compare

export function TasksPage() {
  const navigate = useNavigate();
  const { data: rawTasks = [], isFetching, error } = useTasksQuery();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const [initialRefetchDone, setInitialRefetchDone] = useState(false);
  const { openCreateTask, createTaskOpen } = useModalStore();
  const { selectedTaskId, setSelectedTaskId } = useTaskSelectionStore();
  const { has, isLoaded } = useAuth();
  const archiveMutation = useArchiveTaskMutation();
  const archiveMultipleMutation = useArchiveMultipleTasksMutation();
  
  // Reverse the array so newest appears at top but j/k navigation works correctly
  const tasks = useMemo(() => {
    // drop anything marked archived (supports either a boolean or a status)
    const unarchived = (rawTasks || []).filter((t: any) => !t.archived && t.status !== 'archived');
    return [...unarchived].reverse();
  }, [rawTasks]);
  
  /* warm the cache for the first N tasks so detail pages feel instant */
  const qc = useQueryClient();
  const { data: jwt } = useBackendJwtQuery();

  // Force a network refetch of tasks on first mount
  useEffect(() => {
    // Invalidate first so TanStack won't reuse potentially stale persisted data
    qc.invalidateQueries({ queryKey: ['tasks'] });
    // Kick an immediate refetch (don't wait for focus)
    qc.refetchQueries({ queryKey: ['tasks'], type: 'active' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When isFetching flips false the first time *after* mount, we consider it fresh
  useEffect(() => {
    if (!isFetching) setInitialRefetchDone(true);
  }, [isFetching]);

  // Refetch when the tab becomes visible / window gains focus
  useEffect(() => {
    const onFocusOrVisible = () => {
      qc.refetchQueries({ queryKey: ['tasks'], type: 'active' });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') onFocusOrVisible();
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [qc]);
  
  // Restore selectedIndex from stored selectedTaskId when tasks change
  React.useEffect(() => {
    if (tasks.length > 0) {
      // Try to restore from stored selectedTaskId
      if (selectedTaskId) {
        const storedIndex = tasks.findIndex(t => t.task_id === selectedTaskId);
        if (storedIndex >= 0) {
          setSelectedIndex(storedIndex);
        } else {
          // If stored task not found, use first task and update store
          setSelectedIndex(0);
          setSelectedTaskId(tasks[0].task_id);
        }
      } else {
        // No stored selection, use first task
        setSelectedIndex(0);
        setSelectedTaskId(tasks[0].task_id);
      }
    } else {
      setSelectedIndex(0);
    }
    // Clear selection when tasks change (e.g., after archiving)
    setSelectedTaskIds(prevSelected => {
      const currentTaskIds = new Set(tasks.map(t => t.task_id));
      const filteredSelection = new Set([...prevSelected].filter(id => currentTaskIds.has(id)));
      return filteredSelection;
    });
  }, [tasks, selectedTaskId, setSelectedTaskId]);

  // Derive selectedTask from selectedIndex
  const currentSelectedTask = useMemo(() => {
    return tasks.length > 0 ? tasks[selectedIndex] : null;
  }, [tasks, selectedIndex]);

  // Update store when selectedIndex changes (for j/k navigation)
  useEffect(() => {
    if (currentSelectedTask) {
      setSelectedTaskId(currentSelectedTask.task_id);
    }
  }, [currentSelectedTask, setSelectedTaskId]);

  // Handle task selection changes
  const handleSelectionChange = (taskId: number, selected: boolean) => {
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(taskId);
      } else {
        newSet.delete(taskId);
      }
      return newSet;
    });
  };

  // Archive handler - archives selected tasks if any, otherwise current task
  const handleArchive = () => {
    if (selectedTaskIds.size > 0) {
      // Archive multiple selected tasks
      archiveMultipleMutation.mutate(Array.from(selectedTaskIds), {
        onSuccess: () => {
          const toDrop = new Set(selectedTaskIds);
          qc.setQueryData(['tasks'], (prev: any[] | undefined) =>
            Array.isArray(prev) ? prev.filter(t => !toDrop.has(t.task_id)) : prev
          );
          setSelectedTaskIds(new Set()); // Clear selection
          // Adjust selectedIndex if needed
          if (selectedIndex >= tasks.length - selectedTaskIds.size && selectedIndex > 0) {
            setSelectedIndex(Math.max(0, selectedIndex - selectedTaskIds.size));
          }
        }
      });
    } else if (currentSelectedTask) {
      // Archive current selected task (keyboard navigation fallback)
      archiveMutation.mutate(currentSelectedTask.task_id, {
        onSuccess: () => {
          qc.setQueryData(['tasks'], (prev: any[] | undefined) =>
            Array.isArray(prev) ? prev.filter(t => t.task_id !== currentSelectedTask.task_id) : prev
          );
          // Adjust selectedIndex if we archived the last task
          if (selectedIndex >= tasks.length - 1 && selectedIndex > 0) {
            setSelectedIndex(selectedIndex - 1);
          }
        }
      });
    }
  };

  // Handle toggle selection for current task
  const handleToggleSelect = () => {
    if (currentSelectedTask) {
      handleSelectionChange(currentSelectedTask.task_id, !selectedTaskIds.has(currentSelectedTask.task_id));
    }
  };

  // Use custom hotkeys hook for j/k navigation and archive
  useTaskHotkeys(tasks.length, selectedIndex, setSelectedIndex, handleArchive, handleToggleSelect);

  // Memoize columns to prevent table re-initialization
  const columns = useMemo(() => {
    return createColumns(selectedTaskIds, handleSelectionChange);
  }, [selectedTaskIds]);

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

  // Create task with 'c' key - guard against opening multiple times
  useHotkeys('c', () => {
    if (!createTaskOpen) {
      openCreateTask();
    }
  });

  // Use this to show skeleton instead of possibly-stale data
  const showInitialSkeleton = !initialRefetchDone;

  // Prefetch cache warm-up effect - delay until we know the task list is fresh
  useEffect(() => {
    if (!jwt || tasks.length === 0 || !initialRefetchDone) return;

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
        staleTime: 5 * 60 * 1000,
      });
    });
  }, [tasks, jwt, qc, initialRefetchDone]);

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  const hasValidPlan = has({ plan: 'free' }) || has({ plan: 'swarm_pro' });

  if (!hasValidPlan) {
    return <PricingScreen />;
  }


  return (
    <div className="relative flex-1 min-w-0 overflow-hidden px-3 py-3 md:px-4 md:py-4 pb-32">
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
          loading={showInitialSkeleton || (isFetching && tasks.length === 0)}
          highlightedRow={String(currentSelectedTask?.task_id ?? '')}
        />
      </div>

    </div>
  );
}
