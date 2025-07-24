import React, { useEffect, useState, useRef, useCallback } from "react";
import { ApiService } from "@/services/api";
import { useBackendApi } from "@/services/auth";
import { VirtualisedLogViewer } from "@/components/VirtualisedLogViewer";
import { useTaskLogsQuery } from "@/services/queries";
import { useQueryClient } from "@tanstack/react-query";

interface TaskLog {
  id: number;
  task_id: number;
  log_line: any;
  created_at: string | null;
}

// Helper function to extract log content from mixed input
const extractLogContent = (item: string | TaskLog): string => {
  if (typeof item === 'string') return item;
  if (item && typeof item.log_line === 'object') {
    return JSON.stringify(item.log_line, null, 2);
  }
  return typeof item.log_line === 'string' ? item.log_line : String(item.log_line || '');
};

interface TaskLogViewerProps {
  taskId: number;
  taskStatus?: string;
  hideHeader?: boolean;
  logs?: (string | TaskLog)[];
  onLogsStateChange?: (state: {
    isLoading: boolean;
    isPolling: boolean;
    taskCompleted: boolean;
    logs: string[];
    showPretty: boolean;
    refresh: () => void;
    togglePretty: () => void;
    copyLogs: () => void;
  }) => void;
}

const TaskLogViewerComponent: React.FC<TaskLogViewerProps> = ({ taskId, taskStatus, hideHeader = false, logs: propLogs, onLogsStateChange }) => {
  console.log('🔄 TaskLogViewer render - taskId:', taskId, 'taskStatus:', taskStatus)
  
  /* pull any prefetched logs from React Query – instant render */
  const { data: prefetchedLogs = [], isLoading: prefetchLoading } = useTaskLogsQuery(taskId, !propLogs);

  const initialLogs = propLogs ? propLogs.map(extractLogContent) : (Array.isArray(prefetchedLogs) ? prefetchedLogs.map(extractLogContent) : []);
  const [logs, setLogs] = useState<string[]>(initialLogs); // will be prettified below
  const [isLoading, setIsLoading] = useState(!propLogs && prefetchLoading && (!prefetchedLogs || prefetchedLogs.length === 0));
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [showPretty, setShowPretty] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLogIdRef = useRef<number | null>(null);
  const rawLogsRef = useRef<TaskLog[]>(Array.isArray(prefetchedLogs) ? prefetchedLogs : []);
  const api = useBackendApi();
  const queryClient = useQueryClient();

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
    if (!Array.isArray(rawLogs)) {
      console.warn('formatLogs received non-array data:', rawLogs);
      return [];
    }
    
    if (showPretty) {
      return rawLogs.map(l => {
        if (!l || typeof l.log_line !== 'string') {
          console.warn('Invalid log entry:', l);
          return String(l);
        }
        try { 
          return JSON.stringify(JSON.parse(l.log_line), null, 2); 
        }
        catch { 
          return l.log_line; 
        }
      });
    } else {
      return rawLogs.map(l => {
        if (!l || typeof l.log_line !== 'string') {
          console.warn('Invalid log entry:', l);
          return String(l);
        }
        return l.log_line;
      });
    }
  }, [showPretty]);

  const fetchLogs = useCallback(async (since?: number) => {
    console.log('🔄 TaskLogViewer fetchLogs called - taskId:', taskId, 'since:', since)
    if (since) {
      setIsPolling(true);
    }
    
    try {
      const data = await api(token => ApiService.getTaskLogs(token, taskId, since));
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

      /* keep React Query cache up‑to‑date so other views reuse */
      queryClient.setQueryData(['task-logs', taskId], rawLogsRef.current);

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
  }, [taskId, taskStatus, formatLogs, taskCompleted, api, queryClient]);

  useEffect(() => {
    // Skip fetching if logs are provided via props
    if (propLogs) {
      return;
    }

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
  }, [taskId, taskStatus, fetchLogs, taskCompleted, propLogs]);


  // Update logs when showPretty *or* prefetched update
  useEffect(() => {
    if (propLogs) {
      // When using propLogs, format them if they're JSON strings
      const extractedLogs = propLogs.map(extractLogContent);
      if (showPretty) {
        setLogs(extractedLogs.map(log => {
          try { return JSON.stringify(JSON.parse(log), null, 2); }
          catch { return log; }
        }));
      } else {
        setLogs(extractedLogs);
      }
    } else {
      setLogs(formatLogs(rawLogsRef.current));
    }
  }, [showPretty, formatLogs, prefetchedLogs, propLogs]);

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

  // Update parent with logs state
  useEffect(() => {
    if (onLogsStateChange) {
      onLogsStateChange({
        isLoading,
        isPolling,
        taskCompleted,
        logs,
        showPretty,
        refresh: () => fetchLogs(lastLogIdRef.current || undefined),
        togglePretty: () => setShowPretty(!showPretty),
        copyLogs: copyLogsToClipboard,
      });
    }
  }, [isLoading, isPolling, taskCompleted, logs, showPretty, fetchLogs, copyLogsToClipboard, onLogsStateChange]);

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
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-linear-text">Live Claude Output</h3>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${
              isLoading ? 'bg-linear-text-muted' : 
              taskCompleted ? 'bg-linear-accent' :
              isPolling ? 'bg-linear-accent animate-pulse' : 
              'bg-linear-accent'
            }`} />
            <span className="text-xs text-linear-text-muted font-normal">
              {isLoading ? 'Loading...' : 
               taskCompleted || (taskStatus && ['done', 'failed', 'pr_opened'].includes(taskStatus)) ? `Task completed • ${logs.length} entries` :
               isPolling ? 'Checking for new logs...' :
               `${logs.length} log entries • Polling every 3s`}
            </span>
            {!isLoading && (
              <>
                <button 
                  onClick={() => fetchLogs(lastLogIdRef.current || undefined)} 
                  className="text-xs text-linear-text-muted hover:text-linear-accent transition-colors duration-150 ease-out underline font-normal"
                  disabled={isPolling}
                >
                  Refresh
                </button>
                {logs.length > 0 && (
                  <>
                    <button 
                      onClick={() => setShowPretty(!showPretty)}
                      className="text-xs text-linear-text-muted hover:text-linear-accent transition-colors duration-150 ease-out underline font-normal"
                      title="Toggle between pretty and raw JSON view"
                    >
                      {showPretty ? 'Raw' : 'Pretty'}
                    </button>
                    <button 
                      onClick={copyLogsToClipboard}
                      className="text-xs text-linear-text-muted hover:text-linear-accent transition-colors duration-150 ease-out underline font-normal"
                      title="Copy all logs to clipboard"
                    >
                      Copy
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
      
      <div className="h-96 w-full rounded-md border border-linear-border bg-linear-text p-2">
        {logs.length === 0 && !isLoading ? (
          <span className="text-white/70 text-xs font-normal">No logs yet...</span>
        ) : isLoading && logs.length === 0 ? (
          <span className="text-white/70 text-xs font-normal">Loading logs...</span>
        ) : (
          <VirtualisedLogViewer lines={logs} height={352} />
        )}
      </div>
    </div>
  );
};

// Memoize component to prevent unnecessary re-renders when parent updates
export const TaskLogViewer = React.memo(TaskLogViewerComponent);