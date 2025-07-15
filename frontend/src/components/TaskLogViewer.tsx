import React, { useEffect, useState, useRef, useCallback } from "react";
import { ApiService } from "@/services/api";
import { VirtualisedLogViewer } from "@/components/VirtualisedLogViewer";

interface TaskLog {
  id: number;
  task_id: number;
  log_line: string;
  created_at: string | null;
}

interface TaskLogViewerProps {
  taskId: number;
  taskStatus?: string;
}

const TaskLogViewerComponent: React.FC<TaskLogViewerProps> = ({ taskId, taskStatus }) => {
  console.log('🔄 TaskLogViewer render - taskId:', taskId, 'taskStatus:', taskStatus)
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [showPretty, setShowPretty] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLogIdRef = useRef<number | null>(null);
  const rawLogsRef = useRef<TaskLog[]>([]);

  const copyLogsToClipboard = useCallback(async () => {
    try {
      const allLogsText = logs.join('\n');
      await navigator.clipboard.writeText(allLogsText);
    } catch (err) {
      console.error('Failed to copy logs:', err);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = logs.join('\n');
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }, [logs]);

  const formatLogs = useCallback((rawLogs: TaskLog[]) => {
    if (showPretty) {
      return rawLogs.map(l => {
        try { return JSON.stringify(JSON.parse(l.log_line), null, 2); }
        catch { return l.log_line; }
      });
    } else {
      return rawLogs.map(l => l.log_line);
    }
  }, [showPretty]);

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
        const existingIds = new Set(rawLogsRef.current.map(log => log.id));
        const uniqueNewLogs = newLogs.filter(log => !existingIds.has(log.id));
        
        rawLogsRef.current = [...rawLogsRef.current, ...uniqueNewLogs];
        setLogs(formatLogs(rawLogsRef.current));
      } else {
        // Initial load - replace all logs
        rawLogsRef.current = newLogs;
        setLogs(formatLogs(newLogs));
      }

      // Update last log ID for next poll
      if (newLogs.length > 0) {
        lastLogIdRef.current = newLogs[newLogs.length - 1].id;
      } else if (!since) {
        // If initial load has no logs, set lastLogIdRef to 0 so polling starts from the beginning
        lastLogIdRef.current = 0;
      }

      // Check if task is in finished state based on status prop
      const isFinished = taskStatus && ['done', 'failed', 'pr_opened'].includes(taskStatus);
      
      // Update completion state based on task status
      if (isFinished && !taskCompleted) {
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
      
      // Auto-scroll to bottom when new logs arrive (handled by VirtualisedLogViewer)
      // if (newLogs.length > 0) {
      //   setTimeout(() => {
      //     if (scrollRef.current) {
      //       scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      //     }
      //   }, 10);
      // }
    } catch (err) {
      console.error("Error fetching logs:", err);
      // Batch error state updates
      setError(err instanceof Error ? err.message : "Failed to load logs");
      setIsLoading(false);
      setIsPolling(false);
    }
  }, [taskId, taskStatus, formatLogs, taskCompleted]);

  useEffect(() => {
    // Check if task is in finished state
    const isFinished = taskStatus && ['done', 'failed', 'pr_opened'].includes(taskStatus);
    
    // Always fetch logs initially, regardless of completion status
    fetchLogs().then(() => {
      // Only start polling if task is not completed and not in finished state
      if (!taskCompleted && !isFinished) {
        intervalRef.current = setInterval(() => {
          // Only poll if we have a reference point (lastLogIdRef.current)
          if (lastLogIdRef.current !== null && !taskCompleted && !isFinished) {
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
  }, [taskId, taskStatus, fetchLogs, taskCompleted]);


  // Update logs when showPretty changes
  useEffect(() => {
    if (rawLogsRef.current.length > 0) {
      setLogs(formatLogs(rawLogsRef.current));
    }
  }, [showPretty, formatLogs]);

  // Stop polling when task is completed or in finished state
  useEffect(() => {
    const isFinished = taskStatus && ['done', 'failed', 'pr_opened'].includes(taskStatus);
    if ((taskCompleted || isFinished) && intervalRef.current) {
      setTimeout(() => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, 5000); // Give it 5 seconds to catch final logs
    }
  }, [taskCompleted, taskStatus]);

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
             taskCompleted || (taskStatus && ['done', 'failed', 'pr_opened'].includes(taskStatus)) ? `Task completed • ${logs.length} entries` :
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
                <>
                  <button 
                    onClick={() => setShowPretty(!showPretty)}
                    className="text-xs text-purple-600 hover:text-purple-800 underline"
                    title="Toggle between pretty and raw JSON view"
                  >
                    {showPretty ? '< /> Raw' : '{ } Pretty'}
                  </button>
                  <button 
                    onClick={copyLogsToClipboard}
                    className="text-xs text-green-600 hover:text-green-800 underline"
                    title="Copy all logs to clipboard"
                  >
                    Copy Logs
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
      
      <div className="h-96 w-full rounded-lg border bg-gray-900 p-4">
        {logs.length === 0 && !isLoading ? (
          <span className="text-gray-500 text-xs">No logs yet...</span>
        ) : isLoading && logs.length === 0 ? (
          <span className="text-gray-500 text-xs">Loading logs...</span>
        ) : (
          <VirtualisedLogViewer lines={logs} height={352} />
        )}
      </div>
    </div>
  );
};

// Memoize component to prevent unnecessary re-renders when parent updates
export const TaskLogViewer = React.memo(TaskLogViewerComponent);