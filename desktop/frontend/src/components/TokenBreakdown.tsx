import { useState } from 'react'
import { ChevronDown, FileText } from 'lucide-react'
import { useRepoStore } from '../store/useRepoStore'
import { motion, AnimatePresence } from 'framer-motion'

export default function TokenBreakdown() {
  const { tokenReport } = useRepoStore()
  const [isOpen, setIsOpen] = useState(false)

  if (!tokenReport || tokenReport.files.length === 0) {
    return null
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <FileText className="h-4 w-4" />
        <span>Token breakdown</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border overflow-hidden z-50"
          >
            <div className="p-3 border-b bg-gray-50">
              <h3 className="text-sm font-medium">Token count by file</h3>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {tokenReport.files.map((file) => (
                <div
                  key={file.relpath}
                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-50"
                >
                  <span className="text-sm truncate flex-1 mr-2">
                    {file.relpath}
                  </span>
                  <span className="text-sm text-gray-600 tabular-nums">
                    {file.tokens.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <div className="p-3 border-t bg-gray-50">
              <div className="flex justify-between text-sm font-medium">
                <span>Total</span>
                <span>{tokenReport.total_tokens.toLocaleString()}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}