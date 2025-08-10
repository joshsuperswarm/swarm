import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { Button } from '@/components/ui/button';
import { TaskLogViewer } from '@/components/TaskLogViewer';
import { TodoList } from '@/components/TodoList';
import { statuses } from '@/data/data';
import { useTasksQuery, useTaskDetailsQuery, useTaskTodosQuery } from '@/services/queries';
import { Copy, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { AnimatedTitle } from '@/components/AnimatedTitle';
import { isTitlePending } from '@/lib/titleState';
import { useIsMobile } from '@/hooks/useIsMobile';

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
  const isMobile = useIsMobile();
  
  // Hide log viewer until the user opts in
  const [logsVisible, setLogsVisible] = useState(false);
  
  // Description collapse state - default to collapsed for long descriptions
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  
  // Copy button state
  const [isCopied, setIsCopied] = useState(false);
  
  // Dynamic height calculation for log viewer
  const [logViewerHeight, setLogViewerHeight] = useState(384);
  
  useEffect(() => {
    const calculateHeight = () => {
      if (typeof window === 'undefined') return;
      
      if (isMobile) {
        setLogViewerHeight(Math.max(280, window.innerHeight - 280));
      } else {
        setLogViewerHeight(384);
      }
    };
    
    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    window.addEventListener('orientationchange', calculateHeight);
    
    return () => {
      window.removeEventListener('resize', calculateHeight);
      window.removeEventListener('orientationchange', calculateHeight);
    };
  }, [isMobile]);
  
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
  const { data: taskDetails, isLoading: loading, error } = useTaskDetailsQuery(taskId, isValidTaskId);
  const liveTask = taskDetails?.task;
  
  // Reverse the array to match TasksPage order
  const allTasks = useMemo(() => [...rawAllTasks].reverse(), [rawAllTasks]);
  
  // Get todos for this task
  const messages = taskDetails?.messages || [];
  const firstUserMessage = messages.find((m) => m.role === 'user');
  const derivedDescription = firstUserMessage?.content || '';
  const currentRun = messages.length > 0 ? messages[messages.length - 1]?.run : null;
  const currentRunStatus = currentRun?.run?.status;
  const { data: todos = [], isLoading: isLoadingTodos } = useTaskTodosQuery(
    taskId, 
    currentRunStatus || undefined, 
    isValidTaskId && !!liveTask
  );

  // Find current task index for navigation
  const currentTaskIndex = useMemo(() => {
    if (!liveTask || allTasks.length === 0) return -1;
    return allTasks.findIndex(t => t.task_id === liveTask.id);
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

  const status = statuses.find((s) => s.value === currentRunStatus);
  const showLogsEligible = ['spinning', 'running', 'done', 'failed', 'pr_opened'].includes(
    currentRunStatus ?? ''
  );

  const pendingTitle = isTitlePending({
    title: liveTask.title,
    status: currentRunStatus || null,
    description: derivedDescription || null,
  });

  return (
    <div className="flex-1 w-full px-3 md:px-6 lg:px-8 py-3 md:py-6 pb-28">
      {/* Sticky header container */}
      <div className="sticky top-0 z-30 -mx-3 md:mx-0 bg-white/95 backdrop-blur border-b safe-pt px-3 py-2 mb-6">
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
        
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="flex items-end gap-4">
            <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
              #{liveTask.id}
            </span>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              <AnimatedTitle title={liveTask.title || ""} pending={pendingTitle} status={currentRunStatus} />
            </h1>
          </div>
          
          {/* Right side - Status only */}
          <div className="flex items-center gap-4">
            {status && (
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Status
                </span>
                {status.icon && (
                  <status.icon className="h-3 w-3 text-muted-foreground" />
                )}
                {status.value === "pr_opened" && liveTask.github_pr_url ? (
                  <a 
                    href={liveTask.github_pr_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {status.label}
                  </a>
                ) : (
                  <span className="text-sm">{status.label}</span>
                )}
              </div>
            )}
          </div>
          
        </div>
      </div>

      {/* Task Description */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Description</h3>
        </div>
        {(derivedDescription || 'No description provided').split('\n').length <= 30 || isDescriptionExpanded ? (
          <div className="relative group">
            <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {derivedDescription || 'No description provided'}
            </div>
            <div className="absolute top-2 right-2 flex gap-1">
              {(derivedDescription || 'No description provided').split('\n').length > 30 && (
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
                  const text = derivedDescription || 'No description provided';
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
            {(derivedDescription || 'No description provided').split('\n').length > 30 && (
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
              {(derivedDescription || 'No description provided').split('\n').slice(0, 10).join('\n')}
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
                Expand ({(derivedDescription || 'No description provided').split('\n').length} lines)
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
                     logsState.taskCompleted || (currentRunStatus && ['done', 'failed', 'pr_opened'].includes(currentRunStatus)) ? `Task completed • ${logsState.logs.length} entries` :
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
              taskId={liveTask.id}
              taskStatus={currentRunStatus || undefined}
              hideHeader={true}
              heightPx={logViewerHeight}
              onLogsStateChange={setLogsState}
            />
          )}
          {!logsVisible && (
            <div style={{ display: 'none' }}>
              <TaskLogViewer
                taskId={liveTask.id}
                taskStatus={currentRunStatus || undefined}
                hideHeader={true}
                heightPx={logViewerHeight}
                onLogsStateChange={setLogsState}
              />
            </div>
          )}
        </div>
      )}

    </div>
  );
}