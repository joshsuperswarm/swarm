import { useEffect } from 'react'
import { useRepoStore } from './store/useRepoStore'
import { useChatStore } from './store/useChatStore'
import OpenFolderEmptyState from './components/OpenFolderEmptyState'
import FilePicker from './components/FilePicker'
import FilePills from './components/FilePills'
import TokenCountBadge from './components/TokenCountBadge'
import Chat from './components/Chat'
import { useHotkeys } from 'react-hotkeys-hook'

export default function App() {
  const { repo, loadRecent, selectedFiles } = useRepoStore()
  const { isPickerOpen, setPickerOpen } = useChatStore()

  useEffect(() => {
    loadRecent()
  }, [loadRecent])

  useHotkeys('mod+p', (e) => {
    e.preventDefault()
    if (repo) {
      setPickerOpen(true)
    }
  }, { enableOnFormTags: ['TEXTAREA', 'INPUT'] })

  if (!repo) return <OpenFolderEmptyState />;

  return (
    <div className="flex h-screen flex-col">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="chat-container flex h-12 items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold">{repo.name}</h1>
            <span className="text-xs text-gray-500">{repo.file_count} files</span>
          </div>
          <TokenCountBadge />
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="chat-container h-full">
          <Chat />
        </div>
      </main>

      {selectedFiles.length > 0 && (
        <div className="border-t bg-white">
          <div className="chat-container py-2">
            <FilePills />
          </div>
        </div>
      )}

      <FilePicker open={isPickerOpen} onOpenChange={setPickerOpen} />
    </div>
  )
}