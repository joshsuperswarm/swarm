import React, { useEffect, useState, useRef, useCallback } from "react";
import { ApiService } from "@/services/api";

interface TaskLog {
  id: number;
  task_id: number;
  log_line: string;
  created_at: string | null;
}

interface TaskLogViewerProps {
  taskId: number;
}

const TaskLogViewerComponent: React.FC<TaskLogViewerProps> = ({ taskId }) => {
  console.log('🔄 TaskLogViewer render - taskId:', taskId)
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [taskCompleted, setTaskCompleted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLogIdRef = useRef<number | null>(null);

  const copyLogsToClipboard = useCallback(async () => {
    try {
      const allLogsText = logs.map(log => log.log_line).join('\n');
      await navigator.clipboard.writeText(allLogsText);
    } catch (err) {
      console.error('Failed to copy logs:', err);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = logs.map(log => log.log_line).join('\n');
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }, [logs]);

  const fetchLogs = useCallback(async (since?: number) => {
    console.log('🔄 TaskLogViewer fetchLogs called - taskId:', taskId, 'since:', since)
    if (since) {
      setIsPolling(true);
    }
    
    try {
      const data = await ApiService.getTaskLogs(taskId, since);
      const newLogs = data.logs || [];

      if (since) {
        // Append new logs, but deduplicate based on log ID
        setLogs(prevLogs => {
          const existingIds = new Set(prevLogs.map(log => log.id));
          const uniqueNewLogs = newLogs.filter(log => !existingIds.has(log.id));
          return [...prevLogs, ...uniqueNewLogs];
        });
      } else {
        // Initial load - replace all logs
        setLogs(newLogs);
      }

      // Update last log ID for next poll
      if (newLogs.length > 0) {
        lastLogIdRef.current = newLogs[newLogs.length - 1].id;
      } else if (!since) {
        // If initial load has no logs, set lastLogIdRef to 0 so polling starts from the beginning
        lastLogIdRef.current = 0;
      }

      // Check for task completion in logs (just check new logs for completion)
      const logsToCheck = newLogs;
      const completionFound = logsToCheck.some(log => {
        try {
          const jsonObj = JSON.parse(log.log_line);
          return jsonObj.type === "done";
        } catch {
          return false;
        }
      });

      // Batch all remaining state updates
      if (completionFound && !taskCompleted) {
        setTaskCompleted(true);
        
        // Stop polling after a delay to catch any final logs
        setTimeout(() => {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }, 10000);
      }
      
      // Always update these states regardless of completion
      setError(null);
      setIsLoading(false);
      setIsPolling(false);
      
      // Auto-scroll to bottom when new logs arrive
      if (newLogs.length > 0) {
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 10);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
      // Batch error state updates
      setError(err instanceof Error ? err.message : "Failed to load logs");
      setIsLoading(false);
      setIsPolling(false);
    }
  }, [taskId]); // Remove taskCompleted dependency to prevent blocking initial fetch

  useEffect(() => {
    // Always fetch logs initially, regardless of completion status
    fetchLogs().then(() => {
      // Only start polling if task is not completed
      if (!taskCompleted) {
        intervalRef.current = setInterval(() => {
          // Only poll if we have a reference point (lastLogIdRef.current)
          if (lastLogIdRef.current !== null && !taskCompleted) {
            fetchLogs(lastLogIdRef.current);
          }
        }, 3000);
      }
    });

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [taskId, fetchLogs]); // Remove taskCompleted dependency to ensure initial fetch always happens

  // Stop polling when task is completed
  useEffect(() => {
    if (taskCompleted && intervalRef.current) {
      setTimeout(() => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, 5000); // Give it 5 seconds to catch final logs
    }
  }, [taskCompleted]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-600">{error}</p>
        <button 
          onClick={() => fetchLogs()} 
          className="mt-2 text-xs text-red-700 hover:text-red-900 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Live Claude Output</h3>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${
            isLoading ? 'bg-yellow-500' : 
            taskCompleted ? 'bg-blue-500' :
            isPolling ? 'bg-green-500 animate-pulse' : 
            'bg-green-500'
          }`} />
          <span className="text-xs text-muted-foreground">
            {isLoading ? 'Loading...' : 
             taskCompleted ? `Task completed • ${logs.length} entries` :
             isPolling ? 'Checking for new logs...' :
             `${logs.length} log entries • Polling every 3s`}
          </span>
          {!isLoading && (
            <>
              <button 
                onClick={() => fetchLogs(lastLogIdRef.current || undefined)} 
                className="text-xs text-blue-600 hover:text-blue-800 underline"
                disabled={isPolling}
              >
                Refresh
              </button>
              {logs.length > 0 && (
                <button 
                  onClick={copyLogsToClipboard}
                  className="text-xs text-green-600 hover:text-green-800 underline"
                  title="Copy all logs to clipboard"
                >
                  Copy Logs
                </button>
              )}
            </>
          )}
        </div>
      </div>
      
      <div 
        className="h-96 w-full rounded-lg border bg-gray-900 p-4 overflow-y-auto overflow-x-hidden" 
        ref={scrollRef}
      >
        <div className="w-full overflow-x-auto">
          <pre className="w-full text-xs text-gray-100">
            {logs.length === 0 && !isLoading ? (
              <span className="text-gray-500">No logs yet...</span>
            ) : isLoading && logs.length === 0 ? (
              <span className="text-gray-500">Loading logs...</span>
            ) : (
              logs.map((log) => {
                try {
                  // Try to parse as JSON for pretty printing
                  const jsonObj = JSON.parse(log.log_line);
                  return (
                    <code key={log.id} className="block mb-2 whitespace-pre">
                      {JSON.stringify(jsonObj, null, 2)}
                    </code>
                  );
                } catch {
                  // If not JSON, display as plain text
                  return (
                    <code key={log.id} className="block mb-1 whitespace-pre">
                      {log.log_line}
                    </code>
                  );
                }
              })
            )}
          </pre>
        </div>
      </div>
    </div>
  );
};

// Memoize component to prevent unnecessary re-renders when parent updates
export const TaskLogViewer = React.memo(TaskLogViewerComponent);