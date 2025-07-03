import { useState, useEffect } from "react"
import { useAuth } from "@clerk/clerk-react"
import type { Task } from "@/types"
import { createColumns } from "@/components/data-table/columns"
import { DataTable } from "@/components/data-table/data-table"
import { TaskDetailModal } from "@/components/TaskDetailModal"
import { CreateTaskModal } from "@/components/CreateTaskModal"
import { ApiService } from "@/services/api"
import { getBackendJwt } from "@/lib/authToken"

export function TasksPage() {
  const { isLoaded } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false)

  // Load tasks when auth is ready and JWT is available
  useEffect(() => {
    if (isLoaded) {
      // Add a small delay to ensure JWT has been set in the auth store
      const timeoutId = setTimeout(() => {
        const jwt = getBackendJwt()
        if (jwt) {
          loadTasks()
        } else {
          console.log('Waiting for JWT to be available...')
          // Try again in a moment
          setTimeout(loadTasks, 1000)
        }
      }, 100)
      
      return () => clearTimeout(timeoutId)
    }
  }, [isLoaded])

  const loadTasks = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await ApiService.getTasks()
      
      // Convert backend tasks to frontend format
      const frontendTasks: Task[] = response.tasks.map(task => ({
        id: task.id,
        title: task.title,
        status: task.status as any, // Backend might use different status values
        label: "feature", // Default label - could be determined from task data
        priority: "medium", // Default priority - could be determined from task data
      }))
      
      setTasks(frontendTasks)
    } catch (err) {
      console.error('Failed to load tasks:', err)
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
      
      // Show empty state when API fails
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedTask(null)
  }

  const handleCreateTask = () => {
    setIsCreateTaskModalOpen(true)
  }

  const handleCloseCreateTaskModal = () => {
    setIsCreateTaskModalOpen(false)
  }

  const handleTaskCreated = async (taskData: any) => {
    try {
      await ApiService.createTask({
        title: taskData.title,
        description: taskData.description,
        repository_id: taskData.repositoryId,
      })
      
      // Reload tasks to show the new task
      await loadTasks()
      
      setIsCreateTaskModalOpen(false)
    } catch (err) {
      console.error('Failed to create task:', err)
      // TODO: Show error notification to user
      setIsCreateTaskModalOpen(false)
    }
  }

  const columns = createColumns(handleTaskClick)

  if (!isLoaded) {
    return (
      <div className="h-full flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading authentication...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading tasks...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load tasks</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={loadTasks}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex-1 flex-col space-y-2 p-2 md:flex">
      <DataTable 
        data={tasks} 
        columns={columns}
        onTaskClick={handleTaskClick}
        onCreateTask={handleCreateTask}
      />
      <TaskDetailModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
      <CreateTaskModal
        isOpen={isCreateTaskModalOpen}
        onClose={handleCloseCreateTaskModal}
        onCreateTask={handleTaskCreated}
      />
    </div>
  )
}