import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { TaskLogViewer } from "@/components/TaskLogViewer";
import { useTaskDetailsQuery } from "@/services/queries";

export function TaskLogsPage() {
  const { id } = useParams<{ id: string }>();
  const taskId = parseInt(id || "0", 10);
  
  // Get basic task details for header
  const { data: taskDetails, isLoading } = useTaskDetailsQuery(taskId);
  const task = taskDetails?.task;

  if (isLoading || !task) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-linear-text-muted">Loading task logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-white sticky top-0 z-30 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            to={`/tasks/${taskId}`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Chat
          </Link>
          
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
              #{task.id}
            </span>
            <h1 className="text-lg md:text-xl font-semibold text-gray-900">
              {task.title || "Untitled Task"} - Debug Logs
            </h1>
          </div>
        </div>
      </div>

      {/* Log viewer content */}
      <div className="flex-1 overflow-hidden px-4 py-4">
        <div className="mx-auto w-full max-w-6xl h-full">
          <TaskLogViewer 
            taskId={taskId} 
            taskStatus={task.status || undefined}
            heightPx={600}
          />
        </div>
      </div>
    </div>
  );
}