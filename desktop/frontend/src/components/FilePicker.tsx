import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent } from './ui/dialog'
import { useRepoStore } from '../store/useRepoStore'
import Fuse from 'fuse.js'
import { Check, File } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useHotkeys } from 'react-hotkeys-hook'

interface FilePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function FilePicker({ open, onOpenChange }: FilePickerProps) {
  const { files, selectedFiles, toggleFile } = useRepoStore()
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const fuse = new Fuse(files, {
    keys: ['relpath'],
    threshold: 0.3,
  })

  const filteredFiles = search
    ? fuse.search(search).map(result => result.item)
    : files

  // Reset highlighted index when search changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [search])

  useEffect(() => {
    if (open) {
      setSearch('')
      setHighlightedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Scroll highlighted item into view
  useEffect(() => {
    if (open && listRef.current) {
      const highlightedElement = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`)
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [highlightedIndex, open])

  useHotkeys('down', (e) => {
    e.preventDefault()
    setHighlightedIndex(i => Math.min(i + 1, filteredFiles.length - 1))
  }, { enabled: open, preventDefault: true })

  useHotkeys('up', (e) => {
    e.preventDefault()
    setHighlightedIndex(i => Math.max(i - 1, 0))
  }, { enabled: open, preventDefault: true })

  useHotkeys('enter', (e) => {
    e.preventDefault()
    if (filteredFiles[highlightedIndex]) {
      toggleFile(filteredFiles[highlightedIndex].relpath)
    }
  }, { enabled: open, preventDefault: true })

  useHotkeys('escape', () => {
    onOpenChange(false)
  }, { enabled: open })

  const estimatedTokens = selectedFiles.length * 1000 // Rough estimate

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <div className="flex flex-col h-[600px]">
          <div className="p-4 border-b">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files..."
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto" ref={listRef}>
            <AnimatePresence>
              {filteredFiles.map((file, index) => (
                <motion.div
                  key={file.relpath}
                  data-index={index}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`flex items-center gap-3 px-4 py-2 cursor-pointer ${
                    index === highlightedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => toggleFile(file.relpath)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <File className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-sm truncate">{file.relpath}</span>
                  {selectedFiles.includes(file.relpath) && (
                    <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {selectedFiles.length} files selected
              </span>
              <span className="text-gray-600">
                ~{estimatedTokens.toLocaleString()} tokens
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}