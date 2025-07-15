import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAuth } from '@clerk/clerk-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { TaskLogViewer } from '@/components/TaskLogViewer';
import { statuses } from '@/data/data';
import { ApiService } from '@/services/api';
import { getBackendJwt } from '@/lib/authToken';
import { useTaskPolling } from '@/hooks/useTaskPolling';
import type { Task } from '@/types';

// Key filter to ignore hotkeys when user is typing
const keyFilter = (keyboardEvent: KeyboardEvent) => {
  const target = keyboardEvent.target as HTMLElement;
  const tagName = target.tagName.toLowerCase();
  const isContentEditable = target.contentEditable === "true";
  return !(tagName === "input" || tagName === "textarea" || isContentEditable);
};

export function TaskPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();
  const [initialTask, setInitialTask] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use polling hook to keep task data fresh
  const liveTask = useTaskPolling(initialTask);

  // Find current task index for navigation
  const currentTaskIndex = useMemo(() => {
    if (!liveTask || tasks.length === 0) return -1;
    return tasks.findIndex(t => t.id === liveTask.id);
  }, [liveTask, tasks]);

  // Load tasks and find current task
  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await ApiService.getTasks();
        const allTasks = response.tasks;
        setTasks(allTasks);

        // Find the current task
        const currentTask = allTasks.find(t => t.id === Number(id));
        if (currentTask) {
          setInitialTask(currentTask);
        } else {
          setError('Task not found');
        }
      } catch (err) {
        console.error('Failed to load tasks:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };

    // Wait for authentication to be ready and JWT to be available
    if (isSignedIn && isLoaded && id) {
      // Add a small delay to ensure JWT has been set in the auth store
      const timeoutId = setTimeout(() => {
        const jwt = getBackendJwt();
        if (jwt) {
          loadTasks();
        } else {
          console.log("TaskPage: Waiting for JWT to be available...");
          // Try again in a moment
          setTimeout(loadTasks, 1000);
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [id, isSignedIn, isLoaded]);

  // Navigation hotkeys
  useHotkeys('j', () => {
    if (currentTaskIndex >= 0 && currentTaskIndex < tasks.length - 1) {
      const nextTask = tasks[currentTaskIndex + 1];
      navigate(`/tasks/${nextTask.id}`);
    }
  }, {
    ignoreEventWhen: (e) => !keyFilter(e),
    enabled: tasks.length > 0
  });

  useHotkeys('k', () => {
    if (currentTaskIndex > 0) {
      const prevTask = tasks[currentTaskIndex - 1];
      navigate(`/tasks/${prevTask.id}`);
    }
  }, {
    ignoreEventWhen: (e) => !keyFilter(e),
    enabled: tasks.length > 0
  });

  useHotkeys('esc', () => {
    navigate('/');
  }, {
    ignoreEventWhen: (e) => !keyFilter(e)
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-700 text-sm">Loading task...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {error}
          </h3>
          <div className="space-x-2">
            <Button
              variant="outline"
              onClick={() => navigate('/')}
            >
              Back to Tasks
            </Button>
            <Button
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!liveTask) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Task not found
          </h3>
          <Button
            variant="outline"
            onClick={() => navigate('/')}
          >
            Back to Tasks
          </Button>
        </div>
      </div>
    );
  }

  const status = statuses.find((s) => s.value === liveTask.status);
  const showLogs = ['spinning', 'running', 'done', 'failed', 'pr_opened'].includes(liveTask.status ?? '');

  return (
    <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back to Tasks
          </Button>
        </div>
        
        <div className="flex items-start gap-3">
          <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
            #{liveTask.id}
          </span>
          <h1 className="text-2xl font-bold text-gray-900 flex-1">{liveTask.title}</h1>
        </div>
      </div>

      {/* Task Properties */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg mb-6">
        {status && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Status
            </span>
            <div className="flex items-center">
              {status.icon && (
                <status.icon className="mr-1 h-3 w-3 text-muted-foreground" />
              )}
              <span className="text-sm">{status.label}</span>
            </div>
          </div>
        )}
        
        {liveTask.github_pr_url && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Pull Request
            </div>
            <div>
              <a 
                href={liveTask.github_pr_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline block"
              >
                View on GitHub
              </a>
            </div>
          </div>
        )}
        
        {liveTask.sandbox_id && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Sandbox ID
            </span>
            <span className="text-sm font-mono">{liveTask.sandbox_id}</span>
          </div>
        )}
      </div>

      {/* Task Description */}
      <div className="space-y-3 mb-6">
        <h3 className="text-sm font-semibold">Description</h3>
        <div className="prose prose-sm max-w-none prose-gray">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {liveTask.description || '_No description provided_'}
          </ReactMarkdown>
        </div>
      </div>

      {/* Live Logs */}
      {showLogs && (
        <div className="space-y-3 mb-6">
          <TaskLogViewer taskId={liveTask.id} taskStatus={liveTask.status || undefined} />
        </div>
      )}

    </div>
  );
}