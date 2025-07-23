import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { Button } from '@/components/ui/button';
import { TaskLogViewer } from '@/components/TaskLogViewer';
import { TodoList } from '@/components/TodoList';
import { statuses } from '@/data/data';
import { useTasksQuery, useTaskQuery, useTaskTodosQuery } from '@/services/queries';
import { Copy, ChevronDown, ChevronUp, Check } from 'lucide-react';

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
  
  // Description collapse state - default to collapsed for long descriptions
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  
  // Copy button state
  const [isCopied, setIsCopied] = useState(false);
  
  // Logs state from TaskLogViewer
  const [logsState, setLogsState] = useState<{
    isLoading: boolean;
    isPolling: boolean;
    taskCompleted: boolean;
    logs: string[];
    showPretty: boolean;
    refresh: () => void;
    togglePretty: () => void;
    copyLogs: () => void;
  } | null>(null);
  
  // Parse and validate the task ID
  const taskId = id ? Number(id) : 0;
  const isValidTaskId = taskId > 0 && !isNaN(taskId);
  
  // list for j/k navigation
  const { data: rawAllTasks = [] } = useTasksQuery();
  const { data: liveTask, isLoading: loading, error } = useTaskQuery(taskId, isValidTaskId);
  
  // Reverse the array to match TasksPage order
  const allTasks = useMemo(() => [...rawAllTasks].reverse(), [rawAllTasks]);
  
  // Get todos for this task
  const { data: todos = [], isLoading: isLoadingTodos } = useTaskTodosQuery(
    taskId, 
    liveTask?.status || undefined, 
    isValidTaskId && !!liveTask
  );

  // Find current task index for navigation
  const currentTaskIndex = useMemo(() => {
    if (!liveTask || allTasks.length === 0) return -1;
    return allTasks.findIndex(t => t.task_id === liveTask.task_id);
  }, [liveTask, allTasks]);


  // Navigation hotkeys
  useHotkeys('j', () => {
    if (currentTaskIndex >= 0 && currentTaskIndex < allTasks.length - 1) {
      const nextTask = allTasks[currentTaskIndex + 1];
      navigate(`/tasks/${nextTask.task_id}`);
    }
  }, {
    ignoreEventWhen: (e) => !keyFilter(e),
    enabled: allTasks.length > 0
  });

  useHotkeys('k', () => {
    if (currentTaskIndex > 0) {
      const prevTask = allTasks[currentTaskIndex - 1];
      navigate(`/tasks/${prevTask.task_id}`);
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
            #{liveTask.task_id}
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
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Description</h3>
        </div>
        {(liveTask.description || 'No description provided').split('\n').length <= 30 || isDescriptionExpanded ? (
          <div className="relative group">
            <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {liveTask.description || 'No description provided'}
            </div>
            <div className="absolute top-2 right-2 flex gap-1">
              {(liveTask.description || 'No description provided').split('\n').length > 30 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDescriptionExpanded(false)}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-all bg-white border border-gray-200 hover:bg-gray-50"
                  title="Collapse description"
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const text = liveTask.description || 'No description provided';
                  navigator.clipboard.writeText(text).then(() => {
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 10000);
                  }).catch(() => {
                    // Fallback for browsers that don't support clipboard API
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 10000);
                  });
                }}
                className={`h-6 px-2 opacity-0 group-hover:opacity-100 transition-all bg-white border border-gray-200 hover:bg-gray-50 ${
                  isCopied ? 'opacity-100' : ''
                }`}
                title={isCopied ? 'Copied!' : 'Copy description'}
              >
                {isCopied ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    <span className="text-xs">Copied</span>
                  </>
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            {(liveTask.description || 'No description provided').split('\n').length > 30 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDescriptionExpanded(false)}
                  className="h-8 px-4 text-xs text-muted-foreground hover:text-foreground bg-white border-gray-300 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Collapse
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 leading-relaxed relative overflow-hidden">
            <div className="whitespace-pre-wrap">
              {(liveTask.description || 'No description provided').split('\n').slice(0, 10).join('\n')}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-100 to-transparent pointer-events-none"></div>
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDescriptionExpanded(true)}
                className="h-8 px-4 text-xs text-muted-foreground hover:text-foreground bg-white border-gray-300 shadow-sm"
              >
                <ChevronDown className="h-3 w-3 mr-1" />
                Expand ({(liveTask.description || 'No description provided').split('\n').length} lines)
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Todos */}
      <TodoList todos={todos} loading={isLoadingTodos} />

      {/* Live Logs */}
      {showLogsEligible && (
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Logs</h3>
            <div className="flex items-center gap-2">
              {logsState && (
                <>
                  <div className={`h-2 w-2 rounded-full ${
                    logsState.isLoading ? 'bg-yellow-500' : 
                    logsState.taskCompleted ? 'bg-blue-500' :
                    logsState.isPolling ? 'bg-green-500 animate-pulse' : 
                    'bg-green-500'
                  }`} />
                  <span className="text-xs text-muted-foreground">
                    {logsState.isLoading ? 'Loading...' : 
                     logsState.taskCompleted || (liveTask.status && ['done', 'failed', 'pr_opened'].includes(liveTask.status)) ? `Task completed • ${logsState.logs.length} entries` :
                     logsState.isPolling ? 'Checking for new logs...' :
                     `${logsState.logs.length} log entries • Polling every 3s`}
                  </span>
                  {logsVisible && !logsState.isLoading && (
                    <>
                      <button 
                        onClick={logsState.refresh}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                        disabled={logsState.isPolling}
                      >
                        Refresh
                      </button>
                      {logsState.logs.length > 0 && (
                        <>
                          <button 
                            onClick={logsState.togglePretty}
                            className="text-xs text-purple-600 hover:text-purple-800 underline"
                            title="Toggle between pretty and raw JSON view"
                          >
                            {logsState.showPretty ? '< /> Raw' : '{ } Pretty'}
                          </button>
                          <button 
                            onClick={logsState.copyLogs}
                            className="text-xs text-green-600 hover:text-green-800 underline"
                            title="Copy all logs to clipboard"
                          >
                            Copy Logs
                          </button>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogsVisible(!logsVisible)}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                {logsVisible ? 'Hide logs' : 'Show logs'}
              </Button>
            </div>
          </div>
          {logsVisible && (
            <TaskLogViewer
              taskId={liveTask.task_id}
              taskStatus={liveTask.status || undefined}
              hideHeader={true}
              onLogsStateChange={setLogsState}
            />
          )}
          {!logsVisible && (
            <div style={{ display: 'none' }}>
              <TaskLogViewer
                taskId={liveTask.task_id}
                taskStatus={liveTask.status || undefined}
                hideHeader={true}
                onLogsStateChange={setLogsState}
              />
            </div>
          )}
        </div>
      )}

    </div>
  );
}