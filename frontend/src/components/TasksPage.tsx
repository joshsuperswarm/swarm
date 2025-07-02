import type { Task } from "@/types"
import { columns } from "@/components/data-table/columns"
import { DataTable } from "@/components/data-table/data-table"

// Sample tasks data matching the screenshot aesthetic
const tasks: Task[] = [
  {
    id: "SWARM-8782",
    title: "Implement user authentication with JWT tokens",
    status: "in progress",
    label: "feature",
    priority: "high",
  },
  {
    id: "SWARM-7878",
    title: "Fix memory leak in data processing pipeline",
    status: "backlog",
    label: "bug",
    priority: "urgent",
  },
  {
    id: "SWARM-7839",
    title: "Update API documentation for v2.0 release",
    status: "todo",
    label: "documentation",
    priority: "medium",
  },
  {
    id: "SWARM-5562",
    title: "Optimize database query performance",
    status: "done",
    label: "improvement",
    priority: "high",
  },
  {
    id: "SWARM-8686",
    title: "Add real-time notifications system",
    status: "canceled",
    label: "feature",
    priority: "low",
  },
  {
    id: "SWARM-1234",
    title: "Implement dark mode toggle",
    status: "todo",
    label: "feature",
    priority: "medium",
  },
  {
    id: "SWARM-5678",
    title: "Refactor legacy authentication middleware",
    status: "in progress",
    label: "improvement",
    priority: "high",
  },
  {
    id: "SWARM-9012",
    title: "Write unit tests for user service",
    status: "backlog",
    label: "improvement",
    priority: "medium",
  },
  {
    id: "SWARM-3456",
    title: "Fix responsive layout on mobile devices",
    status: "done",
    label: "bug",
    priority: "high",
  },
  {
    id: "SWARM-7890",
    title: "Create onboarding flow for new users",
    status: "todo",
    label: "feature",
    priority: "low",
  },
]

export function TasksPage() {
  return (
    <div className="h-full flex-1 flex-col space-y-2 p-2 md:flex">
      <DataTable data={tasks} columns={columns} />
    </div>
  )
}