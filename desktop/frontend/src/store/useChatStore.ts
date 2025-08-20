import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { ChatMessage, ImageAttachment } from '../types'
import { useRepoStore } from './useRepoStore'

// Helper functions for structured repo context
function langFromPath(p: string): string {
  const ext = p.toLowerCase().split('.').pop() || ''
  const map: Record<string, string> = {
    ts: 'ts',
    tsx: 'tsx',
    js: 'js',
    jsx: 'jsx',
    json: 'json',
    rs: 'rust',
    toml: 'toml',
    md: 'md',
    css: 'css',
    html: 'html',
    go: 'go',
    py: 'python',
    rb: 'ruby',
    java: 'java',
    kt: 'kotlin',
    cs: 'csharp',
    sh: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
  }
  return map[ext] ?? ''
}

function makeFence(content: string): { open: string; close: string } {
  const candidates = ['```', '````', '~~~~', '~~~~~']
  const pick = candidates.find(f => !content.includes(f)) ?? '`````'
  return { open: pick, close: pick }
}

function fenceCode(content: string, lang: string): string {
  const f = makeFence(content)
  const head = lang ? `${f.open}${lang}\n` : `${f.open}\n`
  return `${head}${content}\n${f.close}`
}

// Batching for stream tokens (module scope)
const tokenBuffers = new Map<string, string[]>()
let rafHandle: number | null = null

function flushPending(
  requestId: string,
  set: (updater: (s: any) => Partial<any>) => void
) {
  const chunks = tokenBuffers.get(requestId)
  if (!chunks?.length) return
  const delta = chunks.join('')
  chunks.length = 0

  set((state: any) => {
    const last = state.messages.length - 1
    if (last < 0) return {}
    const msgs = state.messages.slice()
    msgs[last] = {
      ...msgs[last],
      content: msgs[last].content + delta,
    }
    const apis = state.apiMessages.slice()
    apis[last] = {
      ...apis[last],
      content: apis[last].content + delta,
    }
    return { messages: msgs, apiMessages: apis }
  })
}

function scheduleFlush(
  requestId: string,
  set: (updater: (s: any) => Partial<any>) => void
) {
  if (rafHandle != null) return
  rafHandle = requestAnimationFrame(() => {
    rafHandle = null
    flushPending(requestId, set)
  })
}

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
  droppedImages: ImageAttachment[]
  
  sendMessage: (content: string, images?: ImageAttachment[]) => Promise<void>
  cancelStream: () => Promise<void>
  setPickerOpen: (open: boolean) => void
  resetChat: () => void
  setDroppedImages: (images: ImageAttachment[]) => void
  clearDroppedImages: () => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  apiMessages: [],
  isStreaming: false,
  currentRequestId: null,
  isPickerOpen: false,
  filesAlreadySent: false,
  droppedImages: [],

  sendMessage: async (content: string, images?: ImageAttachment[]) => {
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
- Keep code lines under 80 characters when possible. Break long lines appropriately with proper indentation.
- Do not wrap short identifiers or single-line expressions in code blocks - use inline backticks instead.
- Do not use inline HTML unless explicitly requested.
- Use proper headings, lists, and tables where appropriate.

The user message may include a structured repo context:

<repo_context>
  <file path="relative/path" lang="ts">
\`\`\`ts
// file content
\`\`\`
  </file>
  ...
</repo_context>

The user question will be enclosed in <user_question>…</user_question>.`
    }
    
    // Determine which files to send (only on first message)
    const filesToSend = !filesAlreadySent ? expandedFiles : []
    // For UI display, show top-level selections (folders + individual files)
    let includedFiles: string[] = []
    let fullContent = content
    
    if (filesToSend.length > 0) {
      const fileMap = await invoke<Record<string, string>>(
        'repo_read_files_bulk',
        { relpaths: filesToSend }
      )

      includedFiles = [
        ...selectedFolders.map(f => `${f}/`),
        ...selectedFiles,
      ]

      const parts: string[] = []
      parts.push('<repo_context>')
      for (const relpath of filesToSend) {
        const fileContent = fileMap[relpath] ?? ''
        const lang = langFromPath(relpath)
        parts.push(
          `  <file path="${relpath}" lang="${lang}">`,
          fenceCode(fileContent, lang),
          '  </file>'
        )
      }
      parts.push('</repo_context>', '')

      parts.push('<user_question>', content, '</user_question>')
      fullContent = parts.join('\n')

      set({ filesAlreadySent: true })
    }
    
    // Create user message with just the user's text for display, but full content for API
    const displayMessage: ChatMessage = { 
      role: 'user', 
      content: content,  // Display only user's text
      includedFiles: includedFiles.length > 0 ? includedFiles : undefined,
      images: images
    }
    
    // For API, use the full content with files and images
    const apiMessage: ChatMessage = { 
      role: 'user', 
      content: fullContent,
      images: images 
    }
    
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
        if (event.payload.request_id === requestId) {
          const buf = tokenBuffers.get(requestId) ?? []
          buf.push(event.payload.delta)
          tokenBuffers.set(requestId, buf)
          scheduleFlush(requestId, set)
        }
      })

      const unlistenDone = await listen<StreamDone>('chat_done', (event) => {
        if (event.payload.request_id === requestId) {
          // Final flush of any buffered chunks
          flushPending(requestId, set)
          tokenBuffers.delete(requestId)
          if (rafHandle != null) {
            cancelAnimationFrame(rafHandle)
            rafHandle = null
          }

          set({ isStreaming: false, currentRequestId: null })
          unlistenToken()
          unlistenDone()
        }
      })
    } catch (error) {
      console.error('Failed to send message:', error)
      const errorMessage = typeof error === 'string' ? error : 'Failed to send message'
      
      // Add error message to chat
      set(state => ({
        messages: [...state.messages.slice(0, -1), {
          role: 'assistant',
          content: `❌ Error: ${errorMessage}`
        }],
        apiMessages: [...state.apiMessages.slice(0, -1), {
          role: 'assistant', 
          content: `Error: ${errorMessage}`
        }],
        isStreaming: false,
        currentRequestId: null
      }))
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
  
  resetChat: () => set({ messages: [], apiMessages: [], filesAlreadySent: false, isStreaming: false, currentRequestId: null, droppedImages: [] }),

  setDroppedImages: (images: ImageAttachment[]) => set({ droppedImages: images }),
  
  clearDroppedImages: () => set({ droppedImages: [] }),
}))

// Reset filesAlreadySent when file/folder selection changes
useRepoStore.subscribe((state, prev) => {
  const filesChanged = state.selectedFiles !== prev.selectedFiles
  const foldersChanged = state.selectedFolders !== prev.selectedFolders
  if (filesChanged || foldersChanged) {
    useChatStore.setState({ filesAlreadySent: false })
  }
})