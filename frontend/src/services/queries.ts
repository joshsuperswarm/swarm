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

/* TASK MESSAGES */
export const useTaskMessagesQuery = (taskId: number, taskStatus?: string, enabled: boolean = true) => {
  const { data: jwt, isSuccess } = useBackendJwtQuery()
  
  return useQuery({
    queryKey: ['task-messages', taskId],
    enabled: enabled && taskId > 0 && isSuccess,
    queryFn: () => ApiService.getTaskMessages(jwt!, taskId),
    staleTime: 5 * 1000, // 5 seconds - allow frequent updates
    refetchInterval: () => {
      // Poll every 3 seconds while task is non-terminal
      const isTerminal = ['done', 'failed', 'pr_opened'].includes(taskStatus ?? '');
      return isTerminal ? false : 3 * 1000;
    },
    refetchIntervalInBackground: true,
  })
}

/* TASK DETAILS (unified data) */
export const useTaskDetailsQuery = (taskId: number, enabled: boolean = true) => {
  const { data: jwt, isSuccess } = useBackendJwtQuery()
  
  return useQuery({
    queryKey: ['task-details', taskId],
    enabled: enabled && taskId > 0 && isSuccess,
    queryFn: async () => {
      console.log('→ Fetching task details for taskId:', taskId);
      const result = await ApiService.getTaskDetails(jwt!, taskId);
      console.log('✓ Task details API response:', result);
      console.log('  - Task:', result.task);
      console.log('  - Current run:', result.current_run);
      console.log('  - Messages count:', result.messages?.length || 0);
      console.log('  - Logs count:', result.logs?.entries?.length || 0);
      console.log('  - Todos count:', result.todos?.length || 0);
      return result;
    },
    staleTime: 5 * 1000, // 5 seconds - allow frequent updates
    refetchInterval: (query) => {
      // Poll every 3 seconds while task is non-terminal
      const data = query.state.data;
      const taskStatus = data?.current_run?.status;
      const isTerminal = ['done', 'failed', 'pr_opened'].includes(taskStatus || '');
      return isTerminal ? false : 3 * 1000;
    },
    refetchIntervalInBackground: true,
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

export const useSendMessageMutation = (taskId: number) => {
  const qc = useQueryClient()
  const { data: jwt } = useBackendJwtQuery()
  
  return useMutation({
    mutationFn: (body: { content: string; mode?: Parameters<typeof ApiService.postTaskMessage>[2]['mode'] }) => 
      ApiService.postTaskMessage(jwt!, taskId, body),
    onSuccess: () => {
      // Invalidate messages for this task to refetch
      qc.invalidateQueries({ queryKey: ['task-messages', taskId] })
      // Also invalidate tasks to update status
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}