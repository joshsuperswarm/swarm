import { useState, useRef, useEffect } from 'react'
import { Send, StopCircle } from 'lucide-react'
import { useChatStore } from '../store/useChatStore'
import { useRepoStore } from '../store/useRepoStore'
import MessageBubble from './MessageBubble'
import { useHotkeys } from 'react-hotkeys-hook'
import { invoke } from '@tauri-apps/api/core'

export default function Chat() {
  const { messages, isStreaming, sendMessage, cancelStream } = useChatStore()
  const { selectedFiles, tokenReport } = useRepoStore()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useHotkeys('escape', () => {
    if (isStreaming) {
      cancelStream()
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!input.trim() || isStreaming) return

    if (selectedFiles.length === 0) {
      alert('Please select at least one file first')
      return
    }

    if (tokenReport?.may_exceed_context) {
      alert('Selected files may exceed context window. Please remove some files.')
      return
    }

    setInput('')
    await sendMessage(input)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t bg-white p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder={
              selectedFiles.length === 0
                ? "Select files first (⌘P)"
                : "Ask about the selected files..."
            }
            disabled={isStreaming || selectedFiles.length === 0}
            className="flex-1 resize-none rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            rows={3}
          />
          <button
            type={isStreaming ? 'button' : 'submit'}
            onClick={isStreaming ? cancelStream : undefined}
            disabled={(!input.trim() && !isStreaming) || selectedFiles.length === 0}
            className="self-end px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <StopCircle className="h-5 w-5" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}