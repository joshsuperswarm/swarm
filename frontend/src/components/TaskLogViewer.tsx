import React, { useEffect, useState, useRef } from "react";

interface TaskLogViewerProps {
  taskId: number;
}

export const TaskLogViewer: React.FC<TaskLogViewerProps> = ({ taskId }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Create EventSource connection
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";
    const eventSource = new EventSource(`${apiUrl}/api/tasks/${taskId}/logs/stream`);

    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      const logLine = event.data;
      setLogs((prevLogs) => [...prevLogs, logLine]);
      
      // Auto-scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 10);
    };

    eventSource.onerror = (error) => {
      console.error("SSE Error:", error);
      setIsConnected(false);
      setError("Connection lost. Reconnecting...");
      
      // EventSource will automatically reconnect
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, [taskId]);

  if (error && !isConnected) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Live Claude Output</h3>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
      
      <div 
        className="h-96 w-full rounded-lg border bg-gray-900 p-4 overflow-y-auto" 
        ref={scrollRef}
      >
        <pre className="text-xs text-gray-100">
          {logs.length === 0 ? (
            <span className="text-gray-500">Waiting for logs...</span>
          ) : (
            logs.map((log, index) => {
              try {
                // Try to parse as JSON for pretty printing
                const jsonObj = JSON.parse(log);
                return (
                  <code key={index} className="block mb-2">
                    {JSON.stringify(jsonObj, null, 2)}
                  </code>
                );
              } catch {
                // If not JSON, display as plain text
                return (
                  <code key={index} className="block mb-1">
                    {log}
                  </code>
                );
              }
            })
          )}
        </pre>
      </div>
    </div>
  );
};