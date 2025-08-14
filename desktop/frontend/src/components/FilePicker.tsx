import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent } from './ui/dialog'
import { useRepoStore } from '../store/useRepoStore'
import Fuse from 'fuse.js'
import { Check, File } from 'lucide-react'
// import { motion, AnimatePresence } from 'framer-motion'  // not needed for rows

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
      inputRef.current?.focus()
    }
  }, [open])

  // Scroll highlighted item into view (no smooth to avoid repeated animation)
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${highlightedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, open])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(i => Math.min(i + 1, filteredFiles.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredFiles[highlightedIndex]) {
        toggleFile(filteredFiles[highlightedIndex].relpath)
      }
    } else if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }, [filteredFiles, highlightedIndex, toggleFile, onOpenChange])

  const estimatedTokens = selectedFiles.length * 1000 // Rough estimate

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[900px] max-w-[95vw] p-0 max-h-[80vh]">
        <div className="flex flex-col max-h-[80vh]">
          <div className="p-4 border-b">
            <input
              ref={inputRef}
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search files..."
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div
            className="flex-1 overflow-y-auto"
            ref={listRef}
            role="listbox"
            aria-activedescendant={`file-${highlightedIndex}`}
          >
            {filteredFiles.map((file, index) => {
              const selected = selectedFiles.includes(file.relpath)
              const active = index === highlightedIndex
              return (
                <div
                  key={file.relpath}
                  id={`file-${index}`}
                  data-index={index}
                  className={`grid grid-cols-[16px,1fr,16px] items-center gap-3 px-4 py-2 cursor-pointer min-w-0
                    ${active ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => toggleFile(file.relpath)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  role="option"
                  aria-selected={active}
                >
                  <File className="h-4 w-4 text-gray-400" />
                  <span className="text-sm truncate min-w-0 font-mono" title={file.relpath}>
                    {file.relpath}
                  </span>
                  {/* reserve space so layout doesn't shift when selected */}
                  <span className="h-4 w-4 inline-flex items-center justify-center">
                    {selected ? <Check className="h-4 w-4 text-blue-600" /> : null}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="p-4 border-t bg-gray-50 flex-shrink-0">
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