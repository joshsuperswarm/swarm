import { X, Folder, FileCode } from 'lucide-react'
import { useRepoStore } from '../store/useRepoStore'
import { motion, AnimatePresence } from 'framer-motion'
import { useHotkeys } from 'react-hotkeys-hook'

export default function FilePills() {
  const { selectedFiles, selectedFolders, removeFile, removeFolder } = useRepoStore()

  // Combine files and folders for display
  const allSelected = [
    ...selectedFolders.map(f => ({ type: 'folder' as const, path: f })),
    ...selectedFiles.map(f => ({ type: 'file' as const, path: f }))
  ]

  useHotkeys('backspace', () => {
    if (allSelected.length > 0) {
      const last = allSelected[allSelected.length - 1]
      if (last.type === 'folder') {
        removeFolder(last.path)
      } else {
        removeFile(last.path)
      }
    }
  })

  return (
    <div className="flex flex-wrap gap-2">
      <AnimatePresence>
        {allSelected.map((item) => (
          <motion.div
            key={`${item.type}-${item.path}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs"
          >
            {item.type === 'folder' ? (
              <>
                <Folder className="h-3 w-3 flex-shrink-0" />
                <span className="max-w-[120px] truncate">{item.path}/</span>
              </>
            ) : (
              <>
                <FileCode className="h-3 w-3 flex-shrink-0" />
                <span className="max-w-[120px] truncate">{item.path}</span>
              </>
            )}
            <button
              onClick={() => item.type === 'folder' ? removeFolder(item.path) : removeFile(item.path)}
              className="p-0.5 hover:bg-blue-100 rounded"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}