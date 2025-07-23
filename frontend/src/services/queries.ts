import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { ApiService } from '@/services/api'
import { useBackendJwtQuery } from '@/services/auth'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 min – instant render until then
      gcTime: 30 * 60 * 1000,     // 30 min in memory (renamed from cacheTime)
      refetchOnWindowFocus: false,
      retry: (failureCount, error: unknown) => {
        // Don't retry 404 errors
        const errorAny = error as { message?: string; status?: number };
        if (errorAny?.message?.includes('404') || errorAny?.status === 404) {
          return false;
        }
        // Default retry logic for other errors (max 3 times)
        return failureCount < 3;
      },
    },
  },
})

export const persister = createSyncStoragePersister({
  storage: window.localStorage,
})

/* LIST */
export const useTasksQuery = () => {
  const { data: jwt, isSuccess } = useBackendJwtQuery()
  const qc = useQueryClient()
  
  return useQuery({
    queryKey: ['tasks'],
    enabled: isSuccess,
    queryFn: () => ApiService.getTasks(jwt!, { include: 'todos' }).then(r => {
      // Hydrate the todo cache for each task with bundled todos
      r.tasks.forEach(task => {
        if (task.latest_todos) {
          qc.setQueryData(['task-todos', task.task_id], task.latest_todos)
        }
      })
      return r.tasks
    }),
    placeholderData: () => [],      // render instantly from cache
    staleTime: 5 * 1000,           // 5 seconds - allow frequent updates
    refetchInterval: 5 * 1000,      // Poll every 5 seconds
    refetchIntervalInBackground: true, // Continue polling when tab not focused
  })
}

/* SINGLE TASK */
export const useTaskQuery = (id: number, enabled: boolean = true) => {
  const { data: allTasks = [], isLoading, error, ...tasksQuery } = useTasksQuery()
  
  // Find the specific task from the cached tasks list
  const task = enabled && id ? allTasks.find(task => task.task_id === id) : undefined
  
  // Return the same shape as a regular useQuery
  return {
    data: task,
    isLoading,
    error,
    isSuccess: !isLoading && !error,
    isError: !!error,
    // Include other query properties but avoid duplicates
    refetch: tasksQuery.refetch,
    isFetching: tasksQuery.isFetching,
    status: tasksQuery.status
  }
}

/* TASK TODOS */
export const useTaskTodosQuery = (taskId: number, taskStatus?: string, enabled: boolean = true) => {
  const { data: jwt, isSuccess } = useBackendJwtQuery()
  
  return useQuery({
    queryKey: ['task-todos', taskId],
    enabled: enabled && taskId > 0 && isSuccess,
    queryFn: () => ApiService.getTaskTodos(jwt!, taskId),
    staleTime: 5 * 60 * 1000,           // 5 min
    refetchInterval: () => {
      // Stop polling if task is in terminal state
      const isTerminal = ['done', 'failed', 'pr_opened'].includes(taskStatus ?? '');
      return isTerminal ? false : 5 * 1000; // 5 seconds if not terminal
    },
    refetchIntervalInBackground: true,
  })
}

/* TASK LOGS (single fetch – reused everywhere) */
export const useTaskLogsQuery = (taskId: number, enabled: boolean = true) => {
  const { data: jwt, isSuccess } = useBackendJwtQuery()

  return useQuery({
    queryKey: ['task-logs', taskId],
    enabled: enabled && taskId > 0 && isSuccess,
    queryFn: () => ApiService.getTaskLogs(jwt!, taskId).then(r => r.logs),
    staleTime: Infinity,       // never considered stale – they don't change retroactively
    gcTime: 30 * 60 * 1000, // keep 30 min in memory
  })
}

/* CREATE */
export const useCreateTaskMutation = () => {
  const qc = useQueryClient()
  const { data: jwt } = useBackendJwtQuery()
  
  return useMutation({
    mutationFn: (task: Parameters<typeof ApiService.createTask>[1]) => 
      ApiService.createTask(jwt!, task),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}