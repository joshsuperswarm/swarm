import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { ChatMessage } from '../types'
import { useRepoStore } from './useRepoStore'

interface StreamToken {
  request_id: string
  delta: string
}

interface StreamDone {
  request_id: string
  finish_reason: string | null
  canceled: boolean
}

interface ChatStore {
  messages: ChatMessage[]
  isStreaming: boolean
  currentRequestId: string | null
  isPickerOpen: boolean
  
  sendMessage: (content: string) => Promise<void>
  cancelStream: () => Promise<void>
  setPickerOpen: (open: boolean) => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isStreaming: false,
  currentRequestId: null,
  isPickerOpen: false,

  sendMessage: async (content: string) => {
    const { messages } = get()
    
    // Get selected files from repo store
    const { selectedFiles } = useRepoStore.getState()
    
    // Read file contents and append to message
    let fullContent = content
    if (selectedFiles.length > 0) {
      fullContent += '\n\n--- Selected Files ---\n'
      
      for (const relpath of selectedFiles) {
        try {
          const fileContent = await invoke<string>('repo_read_file', { relpath })
          fullContent += `\n--- ${relpath} ---\n${fileContent}\n`
        } catch (error) {
          console.error(`Failed to read file ${relpath}:`, error)
        }
      }
    }
    
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: fullContent }]
    set({ messages: newMessages })

    try {
      const requestId = await invoke<string>('chat_stream_start', {
        messages: newMessages
      })
      
      set({ 
        isStreaming: true, 
        currentRequestId: requestId,
        messages: [...newMessages, { role: 'assistant', content: '' }]
      })

      const unlistenToken = await listen<StreamToken>('chat_token', (event) => {
        console.log('Received chat_token event:', event.payload)
        console.log('Expected requestId:', requestId)
        if (event.payload.request_id === requestId) {
          console.log('Token matched! Delta:', event.payload.delta)
          set(state => {
            const updatedMessages = state.messages.map((msg, idx) => 
              idx === state.messages.length - 1 
                ? { ...msg, content: msg.content + event.payload.delta }
                : msg
            )
            console.log('Updated last message content:', updatedMessages[updatedMessages.length - 1].content)
            return { messages: updatedMessages }
          })
        } else {
          console.log('Request ID mismatch!')
        }
      })

      const unlistenDone = await listen<StreamDone>('chat_done', (event) => {
        if (event.payload.request_id === requestId) {
          set({ isStreaming: false, currentRequestId: null })
          unlistenToken()
          unlistenDone()
        }
      })
    } catch (error) {
      console.error('Failed to send message:', error)
      set({ isStreaming: false, currentRequestId: null })
    }
  },

  cancelStream: async () => {
    const { currentRequestId } = get()
    if (currentRequestId) {
      try {
        await invoke('chat_stream_cancel', { requestId: currentRequestId })
      } catch (error) {
        console.error('Failed to cancel stream:', error)
      }
    }
  },

  setPickerOpen: (open: boolean) => set({ isPickerOpen: open }),
}))