import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TaskLogViewer } from "./TaskLogViewer";

interface CollapsedLogViewerProps {
  taskId: number;
  logs: string[];
}

export function CollapsedLogViewer({ taskId, logs }: CollapsedLogViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/70 font-normal">
          Agent logs ({logs.length} entries)
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-6 w-6 p-0 text-white/50 hover:text-white/70"
          title={isExpanded ? "Hide logs" : "Show logs"}
        >
          {isExpanded ? "−" : "+"}
        </Button>
      </div>
      
      {isExpanded && (
        <div>
          <TaskLogViewer taskId={taskId} hideHeader logs={logs} />
        </div>
      )}
    </div>
  );
}