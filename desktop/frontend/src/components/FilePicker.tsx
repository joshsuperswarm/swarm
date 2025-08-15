import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Dialog, DialogContent } from './ui/dialog'
import { useRepoStore } from '../store/useRepoStore'
import Fuse from 'fuse.js'
import { Check, File, Folder } from 'lucide-react'

interface FilePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PickerItem = {
  kind: 'folder' | 'file'
  relpath: string
  fileData?: any // Original file metadata if kind === 'file'
}

export default function FilePicker({ open, onOpenChange }: FilePickerProps) {
  const { files, selectedFiles, selectedFolders, toggleFile, toggleFolder, deriveAllFolders, expandedSelectedFiles } = useRepoStore()
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Derive folders from files
  const folders = useMemo(() => deriveAllFolders(files), [files, deriveAllFolders])

  // Create combined items list (folders + files)
  const items = useMemo<PickerItem[]>(() => {
    const folderItems: PickerItem[] = folders.map(f => ({ kind: 'folder', relpath: f }))
    const fileItems: PickerItem[] = files.map(f => ({ kind: 'file', relpath: f.relpath, fileData: f }))
    return [...folderItems, ...fileItems]
  }, [folders, files])

  // Memoize Fuse instance
  const fuse = useMemo(() => new Fuse(items, {
    keys: ['relpath'],
    threshold: 0.3,
  }), [items])

  // Memoize filtered items
  const filteredItems = useMemo(
    () => (search ? fuse.search(search).map(result => result.item) : items),
    [search, fuse, items]
  )

  // Get expanded file count for token estimation
  const expandedFiles = useMemo(() => expandedSelectedFiles(), [expandedSelectedFiles, selectedFiles, selectedFolders])
  const estimatedTokens = expandedFiles.length * 1000 // Rough estimate

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

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${highlightedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, open])

  const handleToggle = useCallback((item: PickerItem) => {
    if (item.kind === 'folder') {
      toggleFolder(item.relpath)
    } else {
      toggleFile(item.relpath)
    }
  }, [toggleFile, toggleFolder])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(i => Math.min(i + 1, filteredItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredItems[highlightedIndex]) {
        handleToggle(filteredItems[highlightedIndex])
        // Close the command palette after selecting with Enter
        onOpenChange(false)
      }
    } else if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }, [filteredItems, highlightedIndex, handleToggle, onOpenChange])

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
              placeholder="Search files and folders..."
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div
            className="flex-1 overflow-y-auto"
            ref={listRef}
            role="listbox"
            aria-activedescendant={`item-${highlightedIndex}`}
          >
            {filteredItems.map((item, index) => {
              const selected = item.kind === 'folder' 
                ? selectedFolders.includes(item.relpath)
                : selectedFiles.includes(item.relpath)
              const active = index === highlightedIndex
              const isFolder = item.kind === 'folder'
              
              return (
                <div
                  key={`${item.kind}-${item.relpath}`}
                  id={`item-${index}`}
                  data-index={index}
                  className={`grid grid-cols-[16px,1fr,16px] items-center gap-3 px-4 py-2 cursor-pointer min-w-0
                    ${active ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => handleToggle(item)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  role="option"
                  aria-selected={active}
                >
                  {isFolder ? (
                    <Folder className="h-4 w-4 text-blue-500" />
                  ) : (
                    <File className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-sm truncate min-w-0 font-mono" title={item.relpath}>
                    {item.relpath}{isFolder ? '/' : ''}
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
                {selectedFolders.length} folders, {selectedFiles.length} files selected
                {expandedFiles.length > selectedFiles.length && (
                  <span className="text-gray-500"> ({expandedFiles.length} total files)</span>
                )}
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