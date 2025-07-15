import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { TaskLogViewer } from '@/components/TaskLogViewer';
import { TodoList } from '@/components/TodoList';
import { statuses } from '@/data/data';
import { useTasksQuery, useTaskQuery, useTaskTodosQuery } from '@/services/queries';

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
  
  // Hide log viewer until the user opts in
  const [logsVisible, setLogsVisible] = useState(false);
  
  // Parse and validate the task ID
  const taskId = id ? Number(id) : 0;
  const isValidTaskId = taskId > 0 && !isNaN(taskId);
  
  // list for j/k navigation
  const { data: allTasks = [] } = useTasksQuery();
  const { data: liveTask, isLoading: loading, error } = useTaskQuery(taskId, isValidTaskId);
  
  // Get todos for this task
  const { data: todos = [], isLoading: isLoadingTodos } = useTaskTodosQuery(
    taskId, 
    liveTask?.status || undefined, 
    isValidTaskId && !!liveTask
  );

  // Find current task index for navigation
  const currentTaskIndex = useMemo(() => {
    if (!liveTask || allTasks.length === 0) return -1;
    return allTasks.findIndex(t => t.id === liveTask.id);
  }, [liveTask, allTasks]);


  // Navigation hotkeys
  useHotkeys('j', () => {
    if (currentTaskIndex >= 0 && currentTaskIndex < allTasks.length - 1) {
      const nextTask = allTasks[currentTaskIndex + 1];
      navigate(`/tasks/${nextTask.id}`);
    }
  }, {
    ignoreEventWhen: (e) => !keyFilter(e),
    enabled: allTasks.length > 0
  });

  useHotkeys('k', () => {
    if (currentTaskIndex > 0) {
      const prevTask = allTasks[currentTaskIndex - 1];
      navigate(`/tasks/${prevTask.id}`);
    }
  }, {
    ignoreEventWhen: (e) => !keyFilter(e),
    enabled: allTasks.length > 0
  });

  useHotkeys('esc', () => {
    navigate('/');
  }, {
    ignoreEventWhen: (e) => !keyFilter(e)
  });

  // Handle invalid task ID
  if (!isValidTaskId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Invalid Task ID
          </h3>
          <p className="text-gray-600 mb-4">The task ID "{id}" is not valid.</p>
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
            {error.message?.includes('404') ? 'Task Not Found' : 'Error loading task'}
          </h3>
          <p className="text-gray-600 mb-4">
            {error.message?.includes('404') 
              ? `Task with ID ${taskId} does not exist.`
              : error.message || 'An error occurred while loading the task.'}
          </p>
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
  const showLogsEligible = ['spinning', 'running', 'done', 'failed', 'pr_opened'].includes(
    liveTask.status ?? ''
  );

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

      {/* Todos */}
      <TodoList todos={todos} loading={isLoadingTodos} />

      {/* Live Logs */}
      {showLogsEligible && (
        <div className="space-y-3 mb-6">
          {!logsVisible ? (
            <Button size="sm" onClick={() => setLogsVisible(true)}>
              Show logs
            </Button>
          ) : (
            <>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setLogsVisible(false)}>
                  Hide logs
                </Button>
              </div>
              <TaskLogViewer
                taskId={liveTask.id}
                taskStatus={liveTask.status || undefined}
              />
            </>
          )}
        </div>
      )}

    </div>
  );
}