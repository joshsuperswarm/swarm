import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useAuth } from "@clerk/clerk-react"
import type { Task } from "@/types"
import { createColumns } from "@/components/data-table/columns"
import { DataTable } from "@/components/data-table/data-table"

// Memoized DataTable to prevent re-renders
const MemoizedDataTable = React.memo(DataTable) as typeof DataTable
import { TaskDetailModal } from "@/components/TaskDetailModal"
import { CreateTaskModal } from "@/components/CreateTaskModal"
import { ApiService } from "@/services/api"
import { getBackendJwt } from "@/lib/authToken"

export function TasksPage() {
  console.log('🔄 TasksPage render')
  const { isLoaded } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load tasks when auth is ready and JWT is available
  useEffect(() => {
    console.log('🔄 TasksPage auth useEffect - isLoaded:', isLoaded)
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

  // Cleanup auto-refresh on unmount
  useEffect(() => {
    return () => {
      if (autoRefreshIntervalRef.current) {
        console.log('🔄 TasksPage unmounting - cleaning up auto-refresh')
        clearInterval(autoRefreshIntervalRef.current)
        autoRefreshIntervalRef.current = null
      }
    }
  }, [])

  const loadTasks = async () => {
    console.log('🔄 TasksPage loadTasks called')
    try {
      // Don't set loading to true during refresh to prevent table unmount
      if (tasks.length === 0) {
        setLoading(true)  // Only show loading spinner on initial load
      } else {
        setIsRefreshing(true)  // Show refresh indicator for subsequent loads
      }
      setError(null)

      const response = await ApiService.getTasks()
      
      // Use tasks directly from backend - no conversion needed since we updated the Task type
      const frontendTasks: Task[] = response.tasks
      
      console.log('🔄 TasksPage setTasks called with', frontendTasks.length, 'tasks')
      setTasks(frontendTasks)
      
      // Auto-refresh logic based on current task status
      const hasRunningTasks = frontendTasks.some(task => 
        task.status === 'spinning' || task.status === 'running'
      )
      
      console.log('🔄 TasksPage auto-refresh check - hasRunningTasks:', hasRunningTasks, 'hasInterval:', !!autoRefreshIntervalRef.current)
      
      if (hasRunningTasks && !autoRefreshIntervalRef.current) {
        console.log('🔄 TasksPage starting auto-refresh for running tasks')
        autoRefreshIntervalRef.current = setInterval(() => {
          console.log('🔄 TasksPage auto-refresh tick - reloading tasks')
          loadTasks()
        }, 10000) // 10 seconds
      } else if (!hasRunningTasks && autoRefreshIntervalRef.current) {
        console.log('🔄 TasksPage stopping auto-refresh - no running tasks')
        clearInterval(autoRefreshIntervalRef.current)
        autoRefreshIntervalRef.current = null
      }
    } catch (err) {
      console.error('Failed to load tasks:', err)
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
      
      // Show empty state when API fails
      setTasks([])
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleTaskClick = useCallback((task: Task) => {
    console.log('🔄 TasksPage handleTaskClick - opening modal for task:', task.id)
    setSelectedTask(task)
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = () => {
    console.log('🔄 TasksPage handleCloseModal - closing modal')
    setIsModalOpen(false)
    setSelectedTask(null)
  }

  const handleCreateTask = useCallback(() => {
    setIsCreateTaskModalOpen(true)
  }, [])

  const handleCloseCreateTaskModal = () => {
    setIsCreateTaskModalOpen(false)
  }

  const handleTaskCreated = async (taskData: { title: string; description: string; repositoryId: number | null; priority: string }) => {
    try {
      if (!taskData.repositoryId) {
        console.error('Repository ID is required');
        return;
      }
      
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

  // Memoize columns to prevent table re-initialization
  const columns = useMemo(() => {
    console.log('🔄 TasksPage columns recreated')
    return createColumns(handleTaskClick)
  }, [handleTaskClick])

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
      {isRefreshing && (
        <div className="fixed top-4 right-4 bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm flex items-center gap-2 z-50">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-700"></div>
          Refreshing tasks...
        </div>
      )}
      <MemoizedDataTable 
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