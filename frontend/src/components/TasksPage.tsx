import { useState } from "react"
import type { Task } from "@/types"
import { createColumns } from "@/components/data-table/columns"
import { DataTable } from "@/components/data-table/data-table"
import { TaskDetailModal } from "@/components/TaskDetailModal"

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
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedTask(null)
  }

  const columns = createColumns(handleTaskClick)

  return (
    <div className="h-full flex-1 flex-col space-y-2 p-2 md:flex">
      <DataTable 
        data={tasks} 
        columns={columns}
        onTaskClick={handleTaskClick}
      />
      <TaskDetailModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  )
}