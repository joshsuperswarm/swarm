import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiService } from '@/services/api';
import { useBackendJwtQuery } from '@/services/auth';
import type { SendMessagePayload } from '@/types/api';
import type { MessageWithRun } from '@/types/generated/MessageWithRun';

export const useSendTaskMessage = (taskId: number) => {
  const queryClient = useQueryClient();
  const { data: jwt } = useBackendJwtQuery();

  return useMutation<
    { message: any; run: any },                      // server response (matches API service return type)
    Error,
    SendMessagePayload                               // variables
  >({
    mutationFn: ({ content, mode }) => {
      if (!jwt) {
        throw new Error('Authentication required');
      }
      return ApiService.postTaskMessage(jwt, taskId, { content, mode });
    },
    onMutate: async ({ content, mode }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['task-details', taskId] });

      // Snapshot the previous value
      const previousTaskDetails = queryClient.getQueryData(['task-details', taskId]);

      // Optimistically update the cache
      queryClient.setQueryData(['task-details', taskId], (old: any) => {
        if (!old) return old;

        const optimisticMessage: MessageWithRun = {
          id: BigInt(-Date.now()),          // temp negative ID
          task_id: taskId,
          role: 'user',
          content,
          created_at: new Date().toISOString(),
          metadata: { pending: true, mode: mode || 'execute' },
          run: null,
        };

        return {
          ...old,
          messages: [...(old.messages || []), optimisticMessage],
        };
      });

      // Return a context object with the snapshotted value
      return { previousTaskDetails };
    },
    onError: (err, _variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context && typeof context === 'object' && 'previousTaskDetails' in context) {
        queryClient.setQueryData(['task-details', taskId], (context as any).previousTaskDetails);
      }
      
      // Show error toast
      console.error('Failed to send message:', err);
      // TODO: Add toast notification
    },
    onSuccess: ({ message, run }) => {
      // Replace the optimistic update with the real data
      queryClient.setQueryData(['task-details', taskId], (old: any) => {
        if (!old) return old;

        // Remove optimistic messages (those with negative IDs) and add the real one
        const realMessages = (old.messages || []).filter((m: any) => Number(m.id) > 0);
        
        // Convert the API response to match our expected format
        const realMessage: MessageWithRun = {
          id: BigInt(message.id),
          task_id: message.task_id,
          role: message.role as 'user' | 'assistant',
          content: message.content,
          created_at: message.created_at,
          metadata: message.metadata || null,
          run: run ? {
            run: {
              id: run.id,
              task_id: run.task_id,
              message_id: run.message_id ? BigInt(run.message_id) : null,
              sandbox_id: run.sandbox_id || null,
              sandbox_hostname: run.sandbox_hostname || null,
              session_id: run.session_id || null,
              command_id: run.command_id || null,
              branch: run.branch || null,
              status: run.status,
              commit_title: run.commit_title || null,
              commit_body: run.commit_body || null,
              mode: run.mode,
              created_at: run.created_at,
              updated_at: run.updated_at || null,
            },
            todos: [],
            logs: {
              entries: [],
              total_count: 0,
              has_more: false,
              cursor: null,
            },
          } : null,
        };

        return {
          ...old,
          messages: [...realMessages, realMessage],
        };
      });

      // Invalidate related queries to pick up the new run
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-details', taskId] });
    },
  });
};