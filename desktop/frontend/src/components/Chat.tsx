import { useState, useRef, useEffect } from 'react'
import { useConversationsStore } from '../store/useConversationsStore'
import { useRepoStore } from '../store/useRepoStore'
import MessageBubble from './MessageBubble'
import FilePills from './FilePills'
import ImagePills from './ImagePills'
import ScrollToBottom from './ScrollToBottom'
import { ImageAttachment } from '../types'
import { fileToBase64 } from '../utils/fileUtils'

interface ChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement>
}

export default function Chat({ textareaRef }: ChatProps) {
  const { conversations, activeId, sendMessage, cancelStream, setDroppedImages } = useConversationsStore()
  const { selectedFiles, selectedFolders } = useRepoStore()
  
  // Get the active conversation
  const activeConversation = conversations.find(c => c.id === activeId)
  const messages = activeConversation?.messages || []
  const isStreaming = activeConversation?.isStreaming || false
  const droppedImages = activeConversation?.droppedImages || []
  const [input, setInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [hasNewerBelow, setHasNewerBelow] = useState(false)
  
  // Use the passed ref if available, otherwise use the internal ref
  const activeTextareaRef = textareaRef || internalTextareaRef

  const scrollToBottom = (smooth = true) =>
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })

  // Helper: tolerant "at bottom" check by math
  const atBottomByMath = () => {
    const el = scrollContainerRef.current
    if (!el) return true
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight
    return gap <= 2 // allow tiny rounding errors
  }

  // Observe sentinel visibility inside the container (tolerant threshold)
  useEffect(() => {
    const container = scrollContainerRef.current
    const sentinel = messagesEndRef.current
    if (!container || !sentinel) return

    const io = new IntersectionObserver(
      ([entry]) => setIsAtBottom(entry.isIntersecting),
      { root: container, threshold: 0.999 }
    )

    io.observe(sentinel)
    return () => io.disconnect()
  }, [])

  // Also update bottom state on scroll (math fallback)
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const onScroll = () => setIsAtBottom(atBottomByMath())
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // When messages change:
  // - if user is at bottom, keep them pinned
  // - if not at bottom, mark that there is newer content below
  useEffect(() => {
    const atBottomNow = isAtBottom || atBottomByMath()
    if (atBottomNow) {
      setHasNewerBelow(false)
      scrollToBottom(false)
    } else {
      // Only set when content actually changed in this chat
      if (messages.length > 0) setHasNewerBelow(true)
    }
  }, [messages]) // messages only from active conversation

  // Reset unseen flag when switching conversations
  useEffect(() => {
    setHasNewerBelow(false)
  }, [activeId])


  // auto-grow textarea
  useEffect(() => {
    const ta = activeTextareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 220) + 'px'
  }, [input, activeTextareaRef])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isStreaming || !activeId) return
    setInput('')
    await sendMessage(activeId, input, droppedImages)
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

    if (activeId) {
      setDroppedImages(activeId, [...droppedImages, ...newImages])
    }
  }

  const removeImage = (index: number) => {
    if (activeId) {
      setDroppedImages(activeId, droppedImages.filter((_, i) => i !== index))
    }
  }

  const atBottomCombined = isAtBottom || atBottomByMath()

  // Show pill only if:
  //  - not at bottom, and
  //  - this chat is streaming OR there are unseen newer messages in this chat
  const atBottomForPill = atBottomCombined || !(isStreaming || hasNewerBelow)

  // Show empty state if no conversation is active
  if (!activeId || !activeConversation) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-xl mb-2">No conversation selected</p>
          <p className="text-sm">Create a new chat or select an existing one</p>
        </div>
      </div>
    )
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
      <div ref={scrollContainerRef} className="h-full overflow-y-auto pb-36 md:pb-40 pt-3 scroll-gutter-stable">
        <div className="chat-container">
          <div className="mx-auto w-full max-w-4xl space-y-4">
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
      </div>

      <ScrollToBottom container={scrollContainerRef.current} atBottom={atBottomForPill} />

      {/* Floating Composer */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40">
        <div className="chat-container pointer-events-auto pb-3">
            <div className="mx-auto w-full max-w-4xl">
              <div className={`rounded-xl md:rounded-2xl border ${isDragging ? 'border-gray-700 border-2' : 'border-gray-200'} bg-white/90 backdrop-blur shadow-lg transition-colors`}>
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
                <div className="group relative flex items-center rounded-md border border-gray-300 bg-white focus-within:border-gray-700 transition-colors overflow-hidden">
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
                    className="flex-1 min-w-0 max-h-56 resize-none bg-transparent px-3 py-2 outline-none font-sans text-gray-900 placeholder:text-gray-500 box-border overflow-x-hidden"
                  />
                  <button
                    type={isStreaming ? 'button' : 'submit'}
                    onClick={isStreaming && activeId ? () => cancelStream(activeId) : handleSubmit}
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
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-gray-500/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="text-2xl font-semibold text-gray-700">
            Drop images here
          </div>
        </div>
      )}
    </div>
  )
}