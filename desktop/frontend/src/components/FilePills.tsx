import { X } from 'lucide-react'
import { useRepoStore } from '../store/useRepoStore'
import { motion, AnimatePresence } from 'framer-motion'
import { useHotkeys } from 'react-hotkeys-hook'

export default function FilePills() {
  const { selectedFiles, removeFile } = useRepoStore()

  useHotkeys('backspace', () => {
    if (selectedFiles.length > 0) {
      removeFile(selectedFiles[selectedFiles.length - 1])
    }
  })

  return (
    <div className="flex flex-wrap gap-2">
      <AnimatePresence>
        {selectedFiles.map((file) => (
          <motion.div
            key={file}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-sm"
          >
            <span className="max-w-[200px] truncate">{file}</span>
            <button
              onClick={() => removeFile(file)}
              className="p-0.5 hover:bg-blue-200 rounded"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}