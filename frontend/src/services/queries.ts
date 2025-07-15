import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { ApiService } from '@/services/api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 min – instant render until then
      gcTime: 30 * 60 * 1000,     // 30 min in memory (renamed from cacheTime)
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Don't retry 404 errors
        if (error?.message?.includes('404') || error?.status === 404) {
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
export const useTasksQuery = () =>
  useQuery({
    queryKey: ['tasks'],
    queryFn: () => ApiService.getTasks().then(r => r.tasks),
    placeholderData: () => [],      // render instantly from cache
  })

/* SINGLE TASK */
export const useTaskQuery = (id: number, enabled: boolean = true) => {
  const { data: allTasks = [], isLoading, error, ...tasksQuery } = useTasksQuery()
  
  // Find the specific task from the cached tasks list
  const task = enabled && id ? allTasks.find(task => task.id === id) : undefined
  
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

/* CREATE */
export const useCreateTaskMutation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ApiService.createTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}