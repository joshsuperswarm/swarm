import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useAuth, SignInButton } from "@clerk/clerk-react";
import { useHotkeys } from "react-hotkeys-hook";
import type { Task } from "@/types";
import { createColumns } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { ApiService } from "@/services/api";
import { getBackendJwt } from "@/lib/authToken";
import { Button } from "@/components/ui/button";

/** Build a Map id → task for quick lookup. */
function toTaskMap(list: Task[]) {
  return new Map(list.map((t) => [t.id, t]));
}

/** Merge `src` into `dest` but keep reference equality when nothing changed. */
function mergeTaskLists(dest: Task[], src: Task[]): Task[] {
  const destMap = toTaskMap(dest);
  const out: Task[] = [];

  let changed = false;

  for (const next of src) {
    const prev = destMap.get(next.id);
    if (
      prev &&
      prev.status === next.status &&
      prev.github_pr_url === next.github_pr_url &&
      prev.updated_at === next.updated_at
    ) {
      out.push(prev); // re-use previous object ⇒ keeps referential equality
    } else {
      out.push(next); // new/updated task
      changed = true;
    }
  }

  // Detect removals
  if (dest.length !== src.length) changed = true;

  return changed ? out : dest; // if nothing changed, return same array ref
}

// Memoize DataTable outside component to ensure stable reference
const MemoizedDataTable = React.memo(DataTable<Task, unknown>); // default shallow compare

// Key filter to ignore hotkeys when user is typing
const keyFilter = (keyboardEvent: KeyboardEvent) => {
  const target = keyboardEvent.target as HTMLElement;
  const tagName = target.tagName.toLowerCase();
  const isContentEditable = target.contentEditable === "true";
  return !(tagName === "input" || tagName === "textarea" || isContentEditable);
};

interface TasksPageProps {
  onCreateTask?: () => void;
}

export function TasksPage({ onCreateTask }: TasksPageProps = {}) {
  // console.log('🔄 TasksPage render')
  const { isSignedIn, isLoaded } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const settledCounterRef = useRef(0);

  const loadTasks = useCallback(async () => {
    // console.log('🔄 TasksPage loadTasks called')
    try {
      // Don't set loading to true during refresh to prevent table unmount
      if (tasks.length === 0) {
        setLoading(true); // Only show loading spinner on initial load
      }
      setError(null);

      const response = await ApiService.getTasks();

      // Use tasks directly from backend - no conversion needed since we updated the Task type
      const frontendTasks: Task[] = response.tasks;

      // Merge tasks to maintain referential equality for unchanged tasks
      setTasks((prev) => mergeTaskLists(prev, frontendTasks));

      // Auto-refresh logic - poll until all tasks are terminal for at least one extra tick
      const unfinished = frontendTasks.some(
        (t) => !["done", "failed", "pr_opened"].includes(t.status ?? ""),
      );

      if (unfinished) {
        // Reset counter when we have unfinished tasks
        settledCounterRef.current = 0;

        // Start interval if not already running
        if (!autoRefreshIntervalRef.current) {
          autoRefreshIntervalRef.current = setInterval(() => {
            loadTasks();
          }, 1000); // 1 seconds
        }
      } else {
        // All tasks are finished - increment counter
        settledCounterRef.current++;

        // Stop polling after one additional fetch with all tasks settled
        if (settledCounterRef.current >= 1 && autoRefreshIntervalRef.current) {
          clearInterval(autoRefreshIntervalRef.current);
          autoRefreshIntervalRef.current = null;
          settledCounterRef.current = 0;
        }
      }
    } catch (err) {
      console.error("Failed to load tasks:", err);
      setError(err instanceof Error ? err.message : "Failed to load tasks");

      // Show empty state when API fails
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Keep selectedIndex within bounds when tasks change
  useEffect(() => {
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

  // Load tasks when auth is ready and JWT is available
  useEffect(() => {
    // console.log('🔄 TasksPage auth useEffect - isSignedIn:', isSignedIn)
    if (isSignedIn && isLoaded) {
      // Add a small delay to ensure JWT has been set in the auth store
      const timeoutId = setTimeout(() => {
        const jwt = getBackendJwt();
        if (jwt) {
          loadTasks();
        } else {
          console.log("Waiting for JWT to be available...");
          // Try again in a moment
          setTimeout(loadTasks, 1000);
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isSignedIn, isLoaded, loadTasks]);

  // Cleanup auto-refresh on unmount
  useEffect(() => {
    return () => {
      if (autoRefreshIntervalRef.current) {
        // console.log('🔄 TasksPage unmounting - cleaning up auto-refresh')
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    };
  }, []);

  // Keyboard navigation hotkeys for table
  useHotkeys('j', () => {
    setSelectedIndex(i => Math.min(i + 1, tasks.length - 1));
  }, {
    ignoreEventWhen: (e) => !keyFilter(e),
    enabled: !isModalOpen && tasks.length > 0
  });

  useHotkeys('k', () => {
    setSelectedIndex(i => Math.max(i - 1, 0));
  }, {
    ignoreEventWhen: (e) => !keyFilter(e),
    enabled: !isModalOpen && tasks.length > 0
  });

  useHotkeys(['o', 'enter'], () => {
    if (currentSelectedTask) {
      setSelectedTask(currentSelectedTask);
      setIsModalOpen(true);
    }
  }, {
    ignoreEventWhen: (e) => !keyFilter(e),
    enabled: !isModalOpen && tasks.length > 0
  });

  const handleTaskClick = useCallback((task: Task) => {
    // console.log('🔄 TasksPage handleTaskClick - opening modal for task:', task.id)
    setSelectedTask(task);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = () => {
    // console.log('🔄 TasksPage handleCloseModal - closing modal')
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  const handleNextTask = () => {
    const nextIndex = (selectedIndex + 1) % tasks.length;
    setSelectedIndex(nextIndex);
    setSelectedTask(tasks[nextIndex]);
  };

  const handlePrevTask = () => {
    const prevIndex = (selectedIndex - 1 + tasks.length) % tasks.length;
    setSelectedIndex(prevIndex);
    setSelectedTask(tasks[prevIndex]);
  };



  // Memoize columns to prevent table re-initialization
  const columns = useMemo(() => {
    // console.log('🔄 TasksPage columns recreated')
    return createColumns(handleTaskClick);
  }, [handleTaskClick]);

  // Show overlays for different states without unmounting the component
  const showAuthSpinner = !isLoaded;
  const showSignInOverlay = !isSignedIn;
  const showErrorOverlay = error && !showSignInOverlay;

  return (
    <div className="relative flex-1 min-w-0 overflow-hidden px-0 py-4 sm:px-6">
      {/* Auth loading overlay */}
      {showAuthSpinner && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-700 text-sm">
              Refreshing authentication…
            </p>
          </div>
        </div>
      )}

      {/* Sign in overlay */}
      {showSignInOverlay && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-white">
          <div className="text-center max-w-md mx-auto px-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              AI Agent Task Manager
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Create tasks for AI agents to work on your GitHub repositories
            </p>
            <div className="bg-white rounded-lg shadow-sm p-8">
              <p className="text-gray-600 mb-4">
                Sign in with GitHub to start creating AI agent tasks for your
                repositories.
              </p>
              <SignInButton mode="modal">
                <button className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
                  Continue with GitHub
                </button>
              </SignInButton>
            </div>
          </div>
        </div>
      )}


      {/* Error overlay */}
      {showErrorOverlay && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/80">
          <div className="text-center max-w-md">
            <div className="text-red-500 mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Failed to load tasks
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => loadTasks()}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}


      {/* Main content - always rendered to prevent unmounting */}
      <div className="flex-1 min-w-0">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Tasks</h1>
            {onCreateTask && (
              <Button
                onClick={onCreateTask}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Create Task
              </Button>
            )}
          </div>
        </div>
        <MemoizedDataTable
          data={tasks}
          columns={columns}
          loading={loading && tasks.length === 0}
          onTaskClick={handleTaskClick}
          highlightedRow={String(currentSelectedTask?.id ?? '')}
        />
      </div>
      <TaskDetailModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onNext={handleNextTask}
        onPrev={handlePrevTask}
      />
    </div>
  );
}
