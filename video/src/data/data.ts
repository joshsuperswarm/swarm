import {
  CheckCircle,
  Circle,
  CircleDot,
  HelpCircle,
  Timer,
  XCircle,
  GitPullRequest,
  AlertCircle,
} from "lucide-react"

export const statuses = [
  {
    value: "pending",
    label: "Pending",
    icon: Circle,
  },
  {
    value: "in_progress", 
    label: "In Progress",
    icon: Timer,
  },
  {
    value: "completed",
    label: "Completed",
    icon: CheckCircle,
  },
  {
    value: "failed",
    label: "Failed", 
    icon: XCircle,
  },
  {
    value: "pr_opened",
    label: "PR Opened",
    icon: GitPullRequest,
  },
  {
    value: "cancelled",
    label: "Cancelled",
    icon: AlertCircle,
  },
]