import type { Task } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { labels, priorities, statuses } from "@/data/data"

interface TaskDetailModalProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
}

export function TaskDetailModal({ task, isOpen, onClose }: TaskDetailModalProps) {
  if (!task) return null

  const label = labels.find((l) => l.value === task.label)
  const status = statuses.find((s) => s.value === task.status)
  const priority = priorities.find((p) => p.value === task.priority)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-start gap-3 text-lg">
            <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
              {task.id}
            </span>
            <span className="flex-1">{task.title}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Task Properties */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
            {label && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Label
                </span>
                <Badge variant="outline" className="text-xs">
                  {label.icon && <label.icon className="mr-1 h-3 w-3" />}
                  {label.label}
                </Badge>
              </div>
            )}
            
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
            
            {priority && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Priority
                </span>
                <div className="flex items-center">
                  {priority.icon && (
                    <priority.icon className="mr-1 h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="text-sm">{priority.label}</span>
                </div>
              </div>
            )}
          </div>

          {/* Task Description */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Description</h3>
            <div className="prose prose-sm max-w-none">
              <p className="text-sm text-muted-foreground leading-relaxed">
                This task is currently using mock data. In a real implementation, 
                this would contain the full task description, requirements, 
                acceptance criteria, comments, attachments, and other relevant details.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You could also include subtasks, time tracking, assignees, 
                due dates, and integration with your project management workflow.
              </p>
            </div>
          </div>

          {/* Placeholder sections for future features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Comments
              </h4>
              <p className="text-xs text-muted-foreground">No comments yet</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Attachments
              </h4>
              <p className="text-xs text-muted-foreground">No attachments</p>
            </div>
          </div>

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