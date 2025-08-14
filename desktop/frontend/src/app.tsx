import { useEffect } from 'react'
import { useRepoStore } from './store/useRepoStore'
import { useChatStore } from './store/useChatStore'
import OpenFolderEmptyState from './components/OpenFolderEmptyState'
import FilePicker from './components/FilePicker'
import FilePills from './components/FilePills'
import TokenCountBadge from './components/TokenCountBadge'
import TokenBreakdown from './components/TokenBreakdown'
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
  })

  if (!repo) {
    return <OpenFolderEmptyState />
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">{repo.name}</h1>
          <span className="text-sm text-gray-500">{repo.file_count} files</span>
        </div>
        <div className="flex items-center gap-2">
          <TokenBreakdown />
          <TokenCountBadge />
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <Chat />
      </div>

      <div className="bg-white border-t">
        {selectedFiles.length > 0 && (
          <div className="px-4 py-2 border-b">
            <FilePills />
          </div>
        )}
        <div className="px-4 py-4">
          <button
            onClick={() => setPickerOpen(true)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Press ⌘P to select files
          </button>
        </div>
      </div>

      <FilePicker open={isPickerOpen} onOpenChange={setPickerOpen} />
    </div>
  )
}