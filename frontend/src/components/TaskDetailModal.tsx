import type { Task } from "@/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { statuses } from "@/data/data"
import { TaskLogViewer } from "@/components/TaskLogViewer"
import { useHotkeys } from "react-hotkeys-hook"
import { useTaskPolling } from "@/hooks/useTaskPolling"

interface TaskDetailModalProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
  onNext?: () => void
  onPrev?: () => void
}

// Key filter to ignore hotkeys when user is typing
const keyFilter = (keyboardEvent: KeyboardEvent) => {
  const target = keyboardEvent.target as HTMLElement;
  const tagName = target.tagName.toLowerCase();
  const isContentEditable = target.contentEditable === "true";
  return !(tagName === "input" || tagName === "textarea" || isContentEditable);
};

export function TaskDetailModal({ task, isOpen, onClose, onNext, onPrev }: TaskDetailModalProps) {
  // console.log('🔄 TaskDetailModal render - task:', task?.id, 'isOpen:', isOpen)
  
  const liveTask = useTaskPolling(task);
  
  // Modal navigation hotkeys
  useHotkeys('j', () => {
    if (onNext) onNext();
  }, {
    ignoreEventWhen: (e) => !keyFilter(e),
    enabled: isOpen
  });

  useHotkeys('k', () => {
    if (onPrev) onPrev();
  }, {
    ignoreEventWhen: (e) => !keyFilter(e),
    enabled: isOpen
  });
  
  if (!liveTask) return null

  const status = statuses.find((s) => s.value === liveTask.status)
  const showLogs = ['spinning', 'running', 'done', 'failed', 'pr_opened'].includes(liveTask.status ?? '')
  
  // console.log('🔄 TaskDetailModal showLogs:', showLogs, 'status:', task.status)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl mx-auto max-h-[80vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-start gap-3 text-lg">
            <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
              #{liveTask.id}
            </span>
            <span className="flex-1">{liveTask.title}</span>
          </DialogTitle>
          <DialogDescription>
            View task details and live logs from Claude Code execution
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 min-w-0">
          {/* Task Properties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
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
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Description</h3>
            <div className="prose prose-sm max-w-none">
              {liveTask.description ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {liveTask.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No description provided.
                </p>
              )}
            </div>
          </div>

          {/* Live Logs */}
          {showLogs && (
            <div className="space-y-3 min-w-0">
              <TaskLogViewer taskId={liveTask.id} />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button size="sm">
              Edit Task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}