import { useMemo, useState } from 'react';
import { ButtonForVideo as Button } from './ui/ButtonForVideo';
import { TodoListForVideoAnimated as TodoList } from './TodoListForVideoAnimated';
import { Copy, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { mockQueries, mockData } from '../mocks/mockProviders';

// Simplified TaskPage for video - remove hooks that don't work in Remotion
export function TaskPageForVideo({ taskId = 56 }: { taskId?: number }) {
  // Use mock data instead of real queries
  const { data: rawAllTasks = [] } = mockQueries.useTasksQuery();
  const { data: taskDetails, isLoading: loading, error } = mockQueries.useTaskDetailsQuery(taskId);
  const liveTask = taskDetails?.task;
  
  // Get todos for this task
  const messages = taskDetails?.messages || [];
  const currentRun = messages.length > 0 ? messages[messages.length - 1]?.run : null;
  const currentRunStatus = currentRun?.run?.status;
  const { data: todos = [], isLoading: isLoadingTodos } = mockQueries.useTaskTodosQuery(taskId);

  // Local state
  const [logsVisible, setLogsVisible] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

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

  if (error || !liveTask) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Task not found
          </h3>
        </div>
      </div>
    );
  }

  const status = mockData.statuses.find((s) => s.value === currentRunStatus);
  const showLogsEligible = ['spinning', 'running', 'done', 'failed', 'pr_opened'].includes(
    currentRunStatus ?? ''
  );

  return (
    <div style={{ 
      backgroundColor: '#FAFAFA', 
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      width: '100%',
      height: '100%',
      padding: '32px 48px',
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px' }}>
          <Button
            variant="ghost"
            size="sm"
            style={{ color: '#6B7280' }}
          >
            ← Back to Tasks
          </Button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
            <span style={{ 
              fontSize: '14px', 
              fontFamily: 'monospace', 
              color: '#6B7280', 
              backgroundColor: '#F8F9FA',
              padding: '4px 8px',
              borderRadius: '4px'
            }}>
              #{liveTask.id}
            </span>
            <h1 style={{ 
              fontSize: '32px', 
              fontWeight: 'bold', 
              color: 'hsl(240, 5%, 10%)',
              margin: 0,
              lineHeight: 1.2
            }}>
              {liveTask.title}
            </h1>
          </div>
          
          {/* Right side - Status only */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {status && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ 
                  fontSize: '12px', 
                  fontWeight: '500', 
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Status
                </span>
                {status.value === "pr_opened" && liveTask.github_pr_url ? (
                  <a 
                    href={liveTask.github_pr_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ fontSize: '14px', color: '#3B82F6', textDecoration: 'none' }}
                  >
                    {status.label}
                  </a>
                ) : (
                  <span style={{ fontSize: '14px', color: 'hsl(240, 5%, 10%)' }}>{status.label}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Description */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '12px' }}>
          <h3 style={{ 
            fontSize: '14px', 
            fontWeight: '600', 
            color: 'hsl(240, 5%, 10%)',
            margin: 0
          }}>
            Description
          </h3>
        </div>
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: '6px',
          padding: '16px',
          fontSize: '14px',
          color: 'hsl(240, 5%, 10%)',
          lineHeight: 1.5
        }}>
          {liveTask.description || 'No description provided'}
        </div>
      </div>

      {/* Todos */}
      <TodoList todos={todos} loading={isLoadingTodos} />

      {/* Logs Section */}
      {showLogsEligible && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: 'hsl(240, 5%, 10%)',
              margin: 0
            }}>
              Logs
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: '#3B82F6' 
              }} />
              <span style={{ 
                fontSize: '12px', 
                color: '#6B7280' 
              }}>
                Task completed • 4478 entries
              </span>
              <button style={{
                fontSize: '12px',
                color: '#3B82F6',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}>
                Show logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}