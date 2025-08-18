import { useState, useRef, useEffect } from 'react'
import { Send, StopCircle } from 'lucide-react'
import { useChatStore } from '../store/useChatStore'
import { useRepoStore } from '../store/useRepoStore'
import MessageBubble from './MessageBubble'
import FilePills from './FilePills'
import ImagePills from './ImagePills'
import { useHotkeys } from 'react-hotkeys-hook'
import ScrollToBottom from './ScrollToBottom'
import { ImageAttachment } from '../types'
import { fileToBase64 } from '../utils/fileUtils'

interface ChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement>
}

export default function Chat({ textareaRef }: ChatProps) {
  const { messages, isStreaming, sendMessage, cancelStream, droppedImages, setDroppedImages } = useChatStore()
  const { selectedFiles, selectedFolders } = useRepoStore()
  const [input, setInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Use the passed ref if available, otherwise use the internal ref
  const activeTextareaRef = textareaRef || internalTextareaRef

  const scrollToBottom = (smooth = true) =>
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })

  // autoscroll only when user is near bottom
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 160
    if (nearBottom) scrollToBottom(false)
  }, [messages])


  // auto-grow textarea
  useEffect(() => {
    const ta = activeTextareaRef.current
    if (!ta) return
    ta.style.height = '0px'
    ta.style.height = Math.min(ta.scrollHeight, 220) + 'px'
  }, [input, activeTextareaRef])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isStreaming) return
    setInput('')
    await sendMessage(input, droppedImages)
    setDroppedImages([])
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))

    if (imageFiles.length === 0) {
      alert('Please drop only image files')
      return
    }

    const newImages: ImageAttachment[] = []
    for (const file of imageFiles) {
      try {
        const base64 = await fileToBase64(file)
        newImages.push({
          data: base64,
          type: file.type,
          name: file.name
        })
      } catch (error) {
        console.error('Error converting image:', error)
      }
    }

    setDroppedImages([...droppedImages, ...newImages])
  }

  const removeImage = (index: number) => {
    setDroppedImages(droppedImages.filter((_, i) => i !== index))
  }

  return (
    <div 
      className="relative h-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Messages */}
      <div ref={scrollContainerRef} className="h-full overflow-y-auto pb-36 md:pb-40 pt-3 px-3">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {messages.map((message, i) => {
            const isLast = i === messages.length - 1
            const isStreamingAssistant = isStreaming && isLast && message.role === 'assistant'
            return (
              <MessageBubble key={i} message={message} streaming={isStreamingAssistant} />
            )
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <ScrollToBottom container={scrollContainerRef.current} />

      {/* Floating Composer */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-3 pb-3">
        <div className="mx-auto w-full max-w-3xl pointer-events-auto">
          <div className={`rounded-xl md:rounded-2xl border ${isDragging ? 'border-blue-500 border-2' : 'border-gray-200'} bg-white/90 backdrop-blur shadow-lg transition-colors`}>
            <div className="flex flex-col gap-2 p-2">
              {/* Image pills row - above file pills */}
              {droppedImages.length > 0 && (
                <div className="overflow-x-auto">
                  <ImagePills images={droppedImages} onRemove={removeImage} />
                </div>
              )}
              {/* File pills row - now always above input */}
              {(selectedFiles.length > 0 || selectedFolders.length > 0) && (
                <div className="overflow-x-auto">
                  <FilePills />
                </div>
              )}
              {/* Input and button row */}
              <div className="w-full">
                <div className="group relative flex items-center rounded-md border border-gray-300 bg-white focus-within:border-blue-500 transition-colors">
                  <textarea
                    ref={activeTextareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSubmit()
                        return
                      }

                      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
                        // Ensure select-all targets only this textarea
                        e.preventDefault()
                        e.stopPropagation()
                        const ta = e.currentTarget as HTMLTextAreaElement
                        // Defer selection to avoid timing quirks
                        requestAnimationFrame(() => ta.select())
                        return
                      }
                    }}
                    placeholder={selectedFiles.length === 0 && selectedFolders.length === 0 ? "Type your message…" : "Ask about the selected files…"}
                    disabled={isStreaming}
                    rows={1}
                    className="max-h-56 w-full resize-none bg-transparent px-3 py-2 outline-none font-sans text-gray-900 placeholder:text-gray-500"
                  />
                  <button
                    type={isStreaming ? 'button' : 'submit'}
                    onClick={isStreaming ? cancelStream : handleSubmit}
                    disabled={!input.trim() && !isStreaming}
                    className="m-1 w-8 h-8 rounded-md bg-gray-900 text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors flex items-center justify-center flex-shrink-0"
                  >
                    {isStreaming ? "⏹" : "→"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-blue-500/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="text-2xl font-semibold text-blue-600">
            Drop images here
          </div>
        </div>
      )}
    </div>
  )
}