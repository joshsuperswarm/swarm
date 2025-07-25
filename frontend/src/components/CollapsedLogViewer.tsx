import { useState } from "react";
import { TaskLogViewer } from "./TaskLogViewer";

interface CollapsedLogViewerProps {
  taskId: number;
  logs: string[];
}

export function CollapsedLogViewer({ taskId, logs }: CollapsedLogViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div>
      <button 
        onClick={() => setIsExpanded(!isExpanded)} 
        className="text-sm font-medium flex items-center gap-2 w-full"
      >
        <span>{isExpanded ? "−" : "+"}</span>
        Agent logs ({logs.length} entries)
      </button>
      
      {isExpanded && (
        <div className="mt-2">
          <TaskLogViewer taskId={taskId} hideHeader logs={logs} />
        </div>
      )}
    </div>
  );
}