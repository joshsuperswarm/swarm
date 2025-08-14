import { ChatMessage } from '../types'
import { User, Bot, FileCode, Clipboard } from 'lucide-react'
import Markdown from './Markdown'
import { useState } from 'react'

interface MessageBubbleProps {
  message: ChatMessage
  streaming?: boolean
}

export default function MessageBubble({ message, streaming }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  const copyAll = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className={`flex gap-3 mb-6 ${isUser ? 'justify-end' : 'justify-center'}`}>
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
          <Bot className="h-4 w-4 text-blue-600" />
        </div>
      )}

      <div className={`relative ${isUser ? 'order-first max-w-2xl' : 'mx-auto w-full max-w-3xl'}`}>
        <div className={`msg-card px-4 py-3 ${isUser ? 'msg-user' : ''}`}>
          <Markdown content={message.content} streaming={!isUser ? streaming : false} />

          {isUser && message.includedFiles?.length ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {message.includedFiles.map((file, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
                  <FileCode className="h-3 w-3" />
                  {file}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* hover copy */}
        <button
          onClick={copyAll}
          className="absolute -top-2 -right-2 hidden rounded-md border bg-white/90 px-2 py-1 text-xs text-gray-700 shadow-sm hover:bg-white md:block group-hover:block"
          aria-label="Copy message"
        >
          <div className="flex items-center gap-1">
            <Clipboard className="h-3.5 w-3.5" />
            {copied ? 'Copied' : 'Copy'}
          </div>
        </button>
      </div>

      {isUser && (
        <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
          <User className="h-4 w-4 text-gray-600" />
        </div>
      )}
    </div>
  )
}