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
    
    // Get expanded file selection from repo store
    const { expandedSelectedFiles, selectedFiles, selectedFolders } = useRepoStore.getState()
    const expandedFiles = expandedSelectedFiles()
    
    // System prompt enforcing Markdown + proper code formatting
    const systemPrompt: ChatMessage = {
      role: 'system',
      content: `You are a helpful assistant that always responds in valid Markdown.
- Use single backticks for inline code: variable names (e.g., \`useClipboard\`), types, field names (e.g., \`may_exceed_context\`), file paths, CLI commands, and literal values.
- ONLY use fenced code blocks (triple backticks with language) for multi-line code samples, never for single identifiers.
- Always specify the language for code blocks: \`\`\`ts for TypeScript, \`\`\`js for JavaScript, \`\`\`json for JSON, etc.
- Do not wrap short identifiers or single-line expressions in code blocks - use inline backticks instead.
- Do not use inline HTML unless explicitly requested.
- Use proper headings, lists, and tables where appropriate.`
    }
    
    // Determine which files to send (only on first message)
    const filesToSend = !filesAlreadySent ? expandedFiles : []
    // For UI display, show top-level selections (folders + individual files)
    let includedFiles: string[] = []
    let fullContent = content
    
    if (filesToSend.length > 0) {
      // Use bulk read API for efficiency
      const fileMap = await invoke<Record<string, string>>('repo_read_files_bulk', { 
        relpaths: filesToSend 
      })
      
      // For display, show folders and individual files (not expanded)
      includedFiles = [
        ...selectedFolders.map(f => `${f}/`),
        ...selectedFiles
      ]
      
      fullContent += '\n\n--- Selected Files ---\n'
      
      for (const relpath of filesToSend) {
        const fileContent = fileMap[relpath] ?? ''
        fullContent += `\n--- ${relpath} ---\n${fileContent}\n`
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
    
    // API messages: prepend system prompt if it's the first message
    const apiMessages = prevApiMessages.length === 0
      ? [systemPrompt, apiMessage]
      : [...prevApiMessages, apiMessage]
    
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