import { useState, useRef, useEffect } from 'react'
import { Send, StopCircle } from 'lucide-react'
import { useChatStore } from '../store/useChatStore'
import { useRepoStore } from '../store/useRepoStore'
import MessageBubble from './MessageBubble'
import FilePills from './FilePills'
import { useHotkeys } from 'react-hotkeys-hook'
import ScrollToBottom from './ScrollToBottom'

export default function Chat() {
  const { messages, isStreaming, sendMessage, cancelStream } = useChatStore()
  const { selectedFiles, selectedFolders } = useRepoStore()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = (smooth = true) =>
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })

  // autoscroll only when user is near bottom
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 160
    if (nearBottom) scrollToBottom(false)
  }, [messages])

  useHotkeys('escape', () => { if (isStreaming) cancelStream() })

  // auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = '0px'
    ta.style.height = Math.min(ta.scrollHeight, 220) + 'px'
  }, [input])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isStreaming) return
    if (selectedFiles.length === 0 && selectedFolders.length === 0) { 
      alert('Please select at least one file or folder first'); 
      return 
    }
    setInput('')
    await sendMessage(input)
  }

  return (
    <div className="relative h-full">
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
          <div className="rounded-xl md:rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-lg">
            <div className="flex flex-col gap-2 p-2">
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
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
                    }}
                    placeholder={selectedFiles.length === 0 && selectedFolders.length === 0 ? "Select files first (⌘P)" : "Ask about the selected files…"}
                    disabled={isStreaming || (selectedFiles.length === 0 && selectedFolders.length === 0)}
                    rows={1}
                    className="max-h-56 w-full resize-none bg-transparent px-3 py-2 outline-none font-sans text-gray-900 placeholder:text-gray-500"
                  />
                  <button
                    type={isStreaming ? 'button' : 'submit'}
                    onClick={isStreaming ? cancelStream : handleSubmit}
                    disabled={(!input.trim() && !isStreaming) || (selectedFiles.length === 0 && selectedFolders.length === 0)}
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
  )
}