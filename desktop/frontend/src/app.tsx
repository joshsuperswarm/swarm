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
        <TokenCountBadge />
      </header>

      <div className="flex-1 overflow-hidden">
        <Chat />
      </div>

      {selectedFiles.length > 0 && (
        <div className="bg-white border-t px-4 py-2">
          <FilePills />
        </div>
      )}

      <FilePicker open={isPickerOpen} onOpenChange={setPickerOpen} />
    </div>
  )
}