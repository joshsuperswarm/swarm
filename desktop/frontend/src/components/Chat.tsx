import { useState, useRef, useEffect } from 'react'
import { Send, StopCircle } from 'lucide-react'
import { useChatStore } from '../store/useChatStore'
import { useRepoStore } from '../store/useRepoStore'
import MessageBubble from './MessageBubble'
import { useHotkeys } from 'react-hotkeys-hook'
import ScrollToBottom from './ScrollToBottom'

export default function Chat() {
  const { messages, isStreaming, sendMessage, cancelStream } = useChatStore()
  const { selectedFiles } = useRepoStore()
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
    if (selectedFiles.length === 0) { alert('Please select at least one file first'); return }
    setInput('')
    await sendMessage(input)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto py-6">
        {messages.map((message, i) => {
          const isLast = i === messages.length - 1
          const isStreamingAssistant = isStreaming && isLast && message.role === 'assistant'
          return (
            <MessageBubble key={i} message={message} streaming={isStreamingAssistant} />
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <ScrollToBottom container={scrollContainerRef.current} />

      {/* Composer */}
      <div className="border-t bg-white pb-6 pt-3">
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl">
          <div className="relative rounded-2xl border bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
              }}
              placeholder={selectedFiles.length === 0 ? "Select files first (⌘P)" : "Ask about the selected files…"}
              disabled={isStreaming || selectedFiles.length === 0}
              rows={1}
              className="max-h-56 w-full resize-none bg-transparent px-3 py-2 outline-none"
            />
            <div className="mt-2 flex items-center justify-between px-2">
              <span className="text-xs text-gray-500">Press Enter to send • Shift+Enter for newline</span>
              <button
                type={isStreaming ? 'button' : 'submit'}
                onClick={isStreaming ? cancelStream : undefined}
                disabled={(!input.trim() && !isStreaming) || selectedFiles.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isStreaming ? (<><StopCircle className="h-4 w-4" /> Stop</>) : (<><Send className="h-4 w-4" /> Send</>)}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}