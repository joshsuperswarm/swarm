import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { 
  ChatMessage, 
  ImageAttachment, 
  Conversation 
} from '../types'
import { useRepoStore } from './useRepoStore'
import { appLocalDataDir } from '@tauri-apps/api/path'
import { 
  readTextFile, 
  writeTextFile, 
  exists
} from '@tauri-apps/plugin-fs'
import { debounce } from 'lodash-es'

// Batching for stream tokens (module scope)
const tokenBuffers = new Map<string, string[]>()
let rafHandle: number | null = null

function flushPending(
  requestId: string,
  conversationId: string,
  set: (updater: (s: any) => Partial<any>) => void
) {
  const chunks = tokenBuffers.get(requestId)
  if (!chunks?.length) return
  const delta = chunks.join('')
  chunks.length = 0

  set((state: any) => {
    const conversations = state.conversations.map((conv: Conversation) => {
      if (conv.id !== conversationId) return conv
      
      const last = conv.messages.length - 1
      if (last < 0) return conv
      
      const msgs = conv.messages.slice()
      msgs[last] = {
        ...msgs[last],
        content: msgs[last].content + delta,
      }
      
      const apis = conv.apiMessages.slice()
      apis[last] = {
        ...apis[last],
        content: apis[last].content + delta,
      }
      
      return {
        ...conv,
        messages: msgs,
        apiMessages: apis
      }
    })
    
    return { conversations }
  })
}

function scheduleFlush(
  requestId: string,
  conversationId: string,
  set: (updater: (s: any) => Partial<any>) => void
) {
  if (rafHandle != null) return
  rafHandle = requestAnimationFrame(() => {
    rafHandle = null
    flushPending(requestId, conversationId, set)
  })
}

interface StreamToken {
  request_id: string
  conversation_id: string
  delta: string
}

interface StreamDone {
  request_id: string
  conversation_id: string
  finish_reason: string | null
  canceled: boolean
}

interface ConversationsStore {
  conversations: Conversation[]
  activeId: string | null
  
  // Actions
  createConversation: () => string
  setActive: (id: string | null) => void
  archiveConversation: (id: string) => void
  unarchiveConversation: (id: string) => void
  deleteConversation: (id: string) => void
  sendMessage: (conversationId: string, content: string, images?: ImageAttachment[]) => Promise<void>
  cancelStream: (conversationId: string) => Promise<void>
  setDroppedImages: (conversationId: string, images: ImageAttachment[]) => void
  clearDroppedImages: (conversationId: string) => void
  
  // Persistence
  loadFromDisk: () => Promise<void>
  saveToDisk: () => void
}

const generateTitle = (content: string): string => {
  const trimmed = content.trim()
  if (trimmed.length === 0) return 'New Chat'
  
  // Take first 40 chars and clean up
  const title = trimmed.substring(0, 40).replace(/\n/g, ' ').trim()
  return title.length > 0 ? title : 'New Chat'
}

const createInitialConversation = (): Conversation => ({
  id: crypto.randomUUID(),
  title: 'New Chat',
  messages: [],
  apiMessages: [],
  isStreaming: false,
  activeRequestId: null,
  archived: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  droppedImages: [],
  filesAlreadySent: false,
})

export const useConversationsStore = create<ConversationsStore>((set, get) => {
  // Debounced save function
  const debouncedSave = debounce(async () => {
    const { conversations } = get()
    try {
      const localDataDir = await appLocalDataDir()
      const filePath = `${localDataDir}/conversations.json`
      await writeTextFile(filePath, JSON.stringify(conversations, null, 2))
    } catch (error) {
      console.error('Failed to save conversations:', error)
    }
  }, 1000)

  const saveToDisk = () => {
    debouncedSave()
  }

  return {
    conversations: [],
    activeId: null,

    createConversation: () => {
      const newConv = createInitialConversation()
      set(state => ({
        conversations: [newConv, ...state.conversations],
        activeId: newConv.id
      }))
      saveToDisk()
      return newConv.id
    },

    setActive: (id: string | null) => {
      set({ activeId: id })
    },

    archiveConversation: (id: string) => {
      set(state => {
        const conversations = state.conversations.map(conv =>
          conv.id === id ? { ...conv, archived: true, updatedAt: Date.now() } : conv
        )
        
        // If archiving the active conversation, switch to most recent non-archived
        let newActiveId = state.activeId
        if (state.activeId === id) {
          const nonArchived = conversations.filter(c => !c.archived)
            .sort((a, b) => b.updatedAt - a.updatedAt)
          newActiveId = nonArchived.length > 0 ? nonArchived[0].id : null
          
          // If no non-archived conversations, create a new one
          if (!newActiveId) {
            const newConv = createInitialConversation()
            conversations.unshift(newConv)
            newActiveId = newConv.id
          }
        }
        
        return { conversations, activeId: newActiveId }
      })
      saveToDisk()
    },

    unarchiveConversation: (id: string) => {
      set(state => ({
        conversations: state.conversations.map(conv =>
          conv.id === id ? { ...conv, archived: false, updatedAt: Date.now() } : conv
        )
      }))
      saveToDisk()
    },

    deleteConversation: (id: string) => {
      set(state => {
        const conversations = state.conversations.filter(conv => conv.id !== id)
        
        // If deleting the active conversation, switch to most recent
        let newActiveId = state.activeId
        if (state.activeId === id) {
          const sorted = conversations
            .filter(c => !c.archived)
            .sort((a, b) => b.updatedAt - a.updatedAt)
          newActiveId = sorted.length > 0 ? sorted[0].id : null
          
          // If no conversations left, create a new one
          if (!newActiveId) {
            const newConv = createInitialConversation()
            conversations.unshift(newConv)
            newActiveId = newConv.id
          }
        }
        
        return { conversations, activeId: newActiveId }
      })
      saveToDisk()
    },

    sendMessage: async (conversationId: string, content: string, images?: ImageAttachment[]) => {
      const { conversations } = get()
      const conversation = conversations.find(c => c.id === conversationId)
      if (!conversation) return

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
- Keep code lines under 80 characters when possible. Break long lines appropriately with proper indentation.
- Do not wrap short identifiers or single-line expressions in code blocks - use inline backticks instead.
- Do not use inline HTML unless explicitly requested.
- Use proper headings, lists, and tables where appropriate.`
      }
      
      // Determine which files to send (only on first message)
      const filesToSend = !conversation.filesAlreadySent ? expandedFiles : []
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
        
        // Clear all files after sending
        const { clearFiles } = useRepoStore.getState()
        clearFiles()
      }
      
      // Create user message with just the user's text for display, but full content for API
      const displayMessage: ChatMessage = { 
        role: 'user', 
        content: content,
        includedFiles: includedFiles.length > 0 ? includedFiles : undefined,
        images: images
      }
      
      // For API, use the full content with files and images
      const apiMessage: ChatMessage = { 
        role: 'user', 
        content: fullContent,
        images: images 
      }
      
      // Update conversation with new messages
      set(state => ({
        conversations: state.conversations.map(conv => {
          if (conv.id !== conversationId) return conv
          
          // Display messages show user's text only
          const displayMessages = [...conv.messages, displayMessage]
          
          // API messages: prepend system prompt if it's the first message
          const apiMessages = conv.apiMessages.length === 0
            ? [systemPrompt, apiMessage]
            : [...conv.apiMessages, apiMessage]
          
          // Update title if this is the first user message
          const newTitle = conv.messages.length === 0 
            ? generateTitle(content)
            : conv.title
          
          return {
            ...conv,
            messages: displayMessages,
            apiMessages,
            filesAlreadySent: filesToSend.length > 0 || conv.filesAlreadySent,
            title: newTitle,
            updatedAt: Date.now()
          }
        })
      }))

      const updatedConversation = get().conversations.find(c => c.id === conversationId)!

      try {
        const requestId = await invoke<string>('chat_stream_start', {
          conversationId,
          messages: updatedConversation.apiMessages
        })
        
        // Add assistant placeholder message and start streaming
        set(state => ({
          conversations: state.conversations.map(conv => {
            if (conv.id !== conversationId) return conv
            return {
              ...conv,
              isStreaming: true,
              activeRequestId: requestId,
              messages: [...conv.messages, { role: 'assistant', content: '' }],
              apiMessages: [...conv.apiMessages, { role: 'assistant', content: '' }],
              droppedImages: [] // Clear dropped images after sending
            }
          })
        }))

        const unlistenToken = await listen<StreamToken>('chat_token', (event) => {
          if (event.payload.request_id === requestId && 
              event.payload.conversation_id === conversationId) {
            const buf = tokenBuffers.get(requestId) ?? []
            buf.push(event.payload.delta)
            tokenBuffers.set(requestId, buf)
            scheduleFlush(requestId, conversationId, set)
          }
        })

        const unlistenDone = await listen<StreamDone>('chat_done', (event) => {
          if (event.payload.request_id === requestId && 
              event.payload.conversation_id === conversationId) {
            // Final flush of any buffered chunks
            flushPending(requestId, conversationId, set)
            tokenBuffers.delete(requestId)
            if (rafHandle != null) {
              cancelAnimationFrame(rafHandle)
              rafHandle = null
            }

            set(state => ({
              conversations: state.conversations.map(conv => {
                if (conv.id !== conversationId) return conv
                return {
                  ...conv,
                  isStreaming: false,
                  activeRequestId: null,
                  updatedAt: Date.now()
                }
              })
            }))
            
            saveToDisk()
            unlistenToken()
            unlistenDone()
          }
        })
      } catch (error) {
        console.error('Failed to send message:', error)
        const errorMessage = typeof error === 'string' ? error : 'Failed to send message'
        
        // Add error message to chat
        set(state => ({
          conversations: state.conversations.map(conv => {
            if (conv.id !== conversationId) return conv
            
            return {
              ...conv,
              messages: [...conv.messages.slice(0, -1), {
                role: 'assistant',
                content: `❌ Error: ${errorMessage}`
              }],
              apiMessages: [...conv.apiMessages.slice(0, -1), {
                role: 'assistant', 
                content: `Error: ${errorMessage}`
              }],
              isStreaming: false,
              activeRequestId: null,
              updatedAt: Date.now()
            }
          })
        }))
        saveToDisk()
      }
    },

    cancelStream: async (conversationId: string) => {
      const { conversations } = get()
      const conversation = conversations.find(c => c.id === conversationId)
      if (conversation?.activeRequestId) {
        try {
          await invoke('chat_stream_cancel', { requestId: conversation.activeRequestId })
        } catch (error) {
          console.error('Failed to cancel stream:', error)
        }
      }
    },

    setDroppedImages: (conversationId: string, images: ImageAttachment[]) => {
      set(state => ({
        conversations: state.conversations.map(conv =>
          conv.id === conversationId ? { ...conv, droppedImages: images } : conv
        )
      }))
    },

    clearDroppedImages: (conversationId: string) => {
      set(state => ({
        conversations: state.conversations.map(conv =>
          conv.id === conversationId ? { ...conv, droppedImages: [] } : conv
        )
      }))
    },

    loadFromDisk: async () => {
      try {
        const localDataDir = await appLocalDataDir()
        const filePath = `${localDataDir}/conversations.json`
        
        if (await exists(filePath)) {
          const content = await readTextFile(filePath)
          const conversations: Conversation[] = JSON.parse(content)
          
          // If no conversations exist, create a default one
          if (conversations.length === 0) {
            const newConv = createInitialConversation()
            set({ 
              conversations: [newConv], 
              activeId: newConv.id 
            })
          } else {
            // Find the most recent non-archived conversation to set as active
            const nonArchived = conversations
              .filter(c => !c.archived)
              .sort((a, b) => b.updatedAt - a.updatedAt)
            
            const activeId = nonArchived.length > 0 ? nonArchived[0].id : conversations[0].id
            
            set({ 
              conversations: conversations.sort((a, b) => b.updatedAt - a.updatedAt), 
              activeId 
            })
          }
        } else {
          // No saved conversations, create a default one
          const newConv = createInitialConversation()
          set({ 
            conversations: [newConv], 
            activeId: newConv.id 
          })
        }
      } catch (error) {
        console.error('Failed to load conversations:', error)
        // Create a default conversation on error
        const newConv = createInitialConversation()
        set({ 
          conversations: [newConv], 
          activeId: newConv.id 
        })
      }
    },

    saveToDisk
  }
})