import { useEffect, useRef, useState } from 'react'
import { useRepoStore } from './store/useRepoStore'
import { useConversationsStore } from './store/useConversationsStore'
import { useApiKey } from './hooks/useApiKey'
import OpenFolderEmptyState from './components/OpenFolderEmptyState'
import FilePicker from './components/FilePicker'
import TokenCountBadge from './components/TokenCountBadge'
import ApiKeySettings from './components/ApiKeySettings'
import Sidebar from './components/Sidebar'
import Chat from './components/Chat'
import { useHotkeys } from 'react-hotkeys-hook'

export default function App() {
  const { repo, loadRecent, clearFiles } = useRepoStore()
  const { 
    conversations, 
    activeId, 
    createConversation, 
    setActive, 
    clearDroppedImages, 
    loadFromDisk 
  } = useConversationsStore()
  const { hasApiKey, isLoading: isLoadingApiKey, recheckApiKey } = useApiKey()
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [isPickerOpen, setPickerOpen] = useState(false)
  
  // Check if the active conversation is currently streaming
  const activeConversation = conversations.find(c => c.id === activeId)
  const isStreaming = activeConversation?.isStreaming ?? false

  useEffect(() => {
    loadRecent()
    loadFromDisk()
  }, [loadRecent, loadFromDisk])

  useHotkeys('mod+p', (e) => {
    e.preventDefault()
    if (repo) {
      setPickerOpen(true)
    }
  }, { enableOnFormTags: ['TEXTAREA', 'INPUT'] })

  // New Chat: Cmd/Ctrl+N
  useHotkeys('mod+n', (e) => {
    e.preventDefault()
    const newId = createConversation()
    setActive(newId)
    // Focus textarea after creating new conversation
    setTimeout(() => {
      chatTextareaRef.current?.focus()
    }, 100)
  }, { enableOnFormTags: ['TEXTAREA', 'INPUT'] })

  // Clear files and images: ESC (only when active conversation is not streaming and FilePicker is not open)
  useHotkeys('escape', (e) => {
    if (!isStreaming && !isPickerOpen) {
      e.preventDefault()
      clearFiles()
      if (activeId) {
        clearDroppedImages(activeId)
      }
    }
  }, { enableOnFormTags: ['TEXTAREA', 'INPUT'] })

  const handleFileSelection = () => {
    // Focus the chat textarea after file selection
    setTimeout(() => {
      chatTextareaRef.current?.focus()
    }, 100)
  }

  if (!repo) return <OpenFolderEmptyState />;

  // Show API key required dialog if no API key is configured
  if (!isLoadingApiKey && hasApiKey === false) {
    return <ApiKeySettings required onApiKeySet={recheckApiKey} />
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
          <div className="flex h-12 items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-semibold text-gray-900">{repo.name}</h1>
              <span className="text-xs text-gray-500">{repo.file_count} files</span>
            </div>
            <div className="flex items-center gap-2">
              <TokenCountBadge />
              <ApiKeySettings onApiKeySet={recheckApiKey} />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          <Chat textareaRef={chatTextareaRef} />
        </main>
      </div>

      <FilePicker open={isPickerOpen} onOpenChange={setPickerOpen} onFileSelected={handleFileSelection} />
    </div>
  )
}