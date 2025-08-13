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
    onMutate: async () => {
      // Cancel any outgoing refetches so they don't overwrite the real update
      await queryClient.cancelQueries({ queryKey: ['task-details', taskId] });

      // Snapshot the previous value for error recovery
      const previousTaskDetails = queryClient.getQueryData(['task-details', taskId]);

      // Return a context object with the snapshotted value
      return { previousTaskDetails };
    },
    onError: (err) => {
      // Show error toast
      console.error('Failed to send message:', err);
      // TODO: Add toast notification
    },
    onSuccess: ({ message, run }) => {
      // Add the real message to existing data
      queryClient.setQueryData(['task-details', taskId], (old: any) => {
        if (!old) return old;

        // Get existing messages since we no longer use optimistic updates
        const existingMessages = old.messages || [];
        
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
              final_message_md: run.final_message_md || null,
              mode: run.mode,
              created_at: run.created_at,
              updated_at: run.updated_at || null,
              idle_timeout_at: run.idle_timeout_at || null,
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
          messages: [...existingMessages, realMessage],
        };
      });

      // Invalidate related queries to pick up the new run
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-details', taskId] });
    },
  });
};