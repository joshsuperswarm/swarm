import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Dialog, DialogPortal } from './ui/dialog'
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from '../lib/cn'
import { useRepoStore } from '../store/useRepoStore'
import Fuse from 'fuse.js'
import { Check, File, Folder } from 'lucide-react'
import { FixedSizeList as List } from 'react-window'

interface FilePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFileSelected?: () => void
}

type PickerItem = {
  kind: 'folder' | 'file'
  relpath: string
  fileData?: any // Original file metadata if kind === 'file'
}

export default function FilePicker({ open, onOpenChange, onFileSelected }: FilePickerProps) {
  const { files, selectedFiles, selectedFolders, toggleFile, toggleFolder, expandedSelectedFiles } = useRepoStore()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<List>(null)

  // Memoize folder derivation with dependency on files length and content hash
  const folders = useMemo(() => {
    const folderSet = new Set<string>()
    for (const file of files) {
      const parts = file.relpath.split('/')
      for (let i = 1; i < parts.length; i++) {
        folderSet.add(parts.slice(0, i).join('/'))
      }
    }
    return [...folderSet].sort()
  }, [files])

  // Create combined items list (folders + files) - memoized more efficiently
  const items = useMemo<PickerItem[]>(() => {
    const result: PickerItem[] = []
    // Add folders first
    for (const folder of folders) {
      result.push({ kind: 'folder', relpath: folder })
    }
    // Add files
    for (const file of files) {
      result.push({ kind: 'file', relpath: file.relpath, fileData: file })
    }
    return result
  }, [folders, files])

  // Memoize Fuse instance with stable options
  const fuse = useMemo(() => new Fuse(items, {
    keys: ['relpath'],
    threshold: 0.3,
    ignoreLocation: true, // Improve fuzzy search performance
    includeScore: false, // We don't need scores
  }), [items])

  // Memoize filtered items using debounced search
  const filteredItems = useMemo(() => {
    if (!debouncedSearch.trim()) return items
    const results = fuse.search(debouncedSearch)
    return results.map(result => result.item)
  }, [debouncedSearch, fuse, items])

  // Get expanded file count for token estimation
  const expandedFiles = useMemo(() => expandedSelectedFiles(), [expandedSelectedFiles, selectedFiles, selectedFolders])
  const estimatedTokens = expandedFiles.length * 1000 // Rough estimate

  // Debounce search input for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 150) // 150ms debounce delay
    
    return () => clearTimeout(timer)
  }, [search])

  // Reset highlighted index when debounced search changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [debouncedSearch])

  useEffect(() => {
    if (open) {
      setSearch('')
      setDebouncedSearch('')
      setHighlightedIndex(0)
      inputRef.current?.focus()
    }
  }, [open])

  // Scroll highlighted item into view (for virtualized list)
  useEffect(() => {
    if (!open || !listRef.current) return
    listRef.current.scrollToItem(highlightedIndex, 'smart')
  }, [highlightedIndex, open])

  const handleToggle = useCallback((item: PickerItem) => {
    if (item.kind === 'folder') {
      toggleFolder(item.relpath)
    } else {
      toggleFile(item.relpath)
    }
    
    // Call the onFileSelected callback after selection
    onFileSelected?.()
  }, [toggleFile, toggleFolder, onFileSelected])

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

  // Memoized row component for virtualization
  const RowComponent = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = filteredItems[index]
    if (!item) return null

    const selected = item.kind === 'folder' 
      ? selectedFolders.includes(item.relpath)
      : selectedFiles.includes(item.relpath)
    const active = index === highlightedIndex
    const isFolder = item.kind === 'folder'
    
    return (
      <div
        key={`${item.kind}-${item.relpath}`}
        style={style}
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
  }, [filteredItems, selectedFolders, selectedFiles, highlightedIndex, handleToggle])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-[900px] max-w-[95vw] translate-x-[-50%] translate-y-[-50%] border bg-white p-0 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-2xl max-h-[80vh]"
          )}
        >
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

            <div className="flex-1 overflow-hidden">
              <List
                ref={listRef}
                height={400} // Fixed height for virtualization
                width="100%" // Required width property
                itemCount={filteredItems.length}
                itemSize={40} // Height per item (py-2 = 8px + content ~32px)
                overscanCount={5} // Render extra items for smooth scrolling
              >
                {RowComponent}
              </List>
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
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}