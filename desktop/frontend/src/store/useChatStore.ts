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
  apiMessages: ChatMessage[] // Track API messages separately
  isStreaming: boolean
  currentRequestId: string | null
  isPickerOpen: boolean
  filesAlreadySent: boolean
  
  sendMessage: (content: string) => Promise<void>
  cancelStream: () => Promise<void>
  setPickerOpen: (open: boolean) => void
  resetChat: () => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  apiMessages: [],
  isStreaming: false,
  currentRequestId: null,
  isPickerOpen: false,
  filesAlreadySent: false,

  sendMessage: async (content: string) => {
    const { messages, apiMessages: prevApiMessages, filesAlreadySent } = get()
    
    // Get selected files from repo store
    const { selectedFiles } = useRepoStore.getState()
    
    // Track which files are included for display purposes
    let includedFiles: string[] = []
    
    // Read file contents and append to message - only on first message
    let fullContent = content
    if (selectedFiles.length > 0 && !filesAlreadySent) {
      fullContent += '\n\n--- Selected Files ---\n'
      includedFiles = selectedFiles
      
      for (const relpath of selectedFiles) {
        try {
          const fileContent = await invoke<string>('repo_read_file', { relpath })
          fullContent += `\n--- ${relpath} ---\n${fileContent}\n`
        } catch (error) {
          console.error(`Failed to read file ${relpath}:`, error)
        }
      }
      
      // Mark files as sent
      set({ filesAlreadySent: true })
    }
    
    // Create user message with just the user's text for display, but full content for API
    const displayMessage: ChatMessage = { 
      role: 'user', 
      content: content,  // Display only user's text
      includedFiles: includedFiles.length > 0 ? includedFiles : undefined
    }
    
    // For API, use the full content with files
    const apiMessage: ChatMessage = { role: 'user', content: fullContent }
    
    // Display messages show user's text only
    const displayMessages = [...messages, displayMessage]
    
    // API messages preserve the full content including files
    const apiMessages = [...prevApiMessages, apiMessage]
    
    const newMessages: ChatMessage[] = displayMessages
    set({ messages: newMessages, apiMessages })

    try {
      const requestId = await invoke<string>('chat_stream_start', {
        messages: apiMessages
      })
      
      set({ 
        isStreaming: true, 
        currentRequestId: requestId,
        messages: [...newMessages, { role: 'assistant', content: '' }],
        apiMessages: [...apiMessages, { role: 'assistant', content: '' }]
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
            const updatedApiMessages = state.apiMessages.map((msg, idx) => 
              idx === state.apiMessages.length - 1 
                ? { ...msg, content: msg.content + event.payload.delta }
                : msg
            )
            console.log('Updated last message content:', updatedMessages[updatedMessages.length - 1].content)
            return { messages: updatedMessages, apiMessages: updatedApiMessages }
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
  
  resetChat: () => set({ messages: [], apiMessages: [], filesAlreadySent: false, isStreaming: false, currentRequestId: null }),
}))