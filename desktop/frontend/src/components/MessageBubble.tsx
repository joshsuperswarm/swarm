import { ChatMessage } from '../types'
import { User, Bot, FileCode, Clipboard, Folder, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import Markdown from './Markdown'
import { useState } from 'react'

interface MessageBubbleProps {
  message: ChatMessage
  streaming?: boolean
}

export default function MessageBubble({ message, streaming }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const isThinking = !isUser && streaming && (message.content?.length ?? 0) === 0

  const copyAll = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className={`${isUser ? 'flex justify-end' : 'flex justify-start'} mt-4`}>
      <div className={`relative group ${isUser ? 'w-full md:max-w-md' : 'w-full'} rounded-lg border p-3 md:p-4 text-sm shadow-sm ${isUser ? 'bg-gray-100 border-gray-200 text-gray-700' : 'bg-white border-gray-200 text-gray-900'}`}>
        <div className="leading-relaxed [word-break:break-word]">
          {isThinking ? (
            <ThinkingIndicator />
          ) : (
            <Markdown content={message.content} streaming={!isUser ? streaming : false} />
          )}

          {isUser && message.includedFiles?.length ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {message.includedFiles.map((file, i) => {
                const isFolder = file.endsWith('/')
                return (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 border border-gray-200">
                    {isFolder ? (
                      <Folder className="h-3 w-3" />
                    ) : (
                      <FileCode className="h-3 w-3" />
                    )}
                    {file}
                  </span>
                )
              })}
            </div>
          ) : null}
        </div>

        {/* hover copy */}
        <button
          onClick={copyAll}
          className="absolute top-2 right-2 hidden group-hover:block rounded-md border border-gray-200 bg-white h-6 px-2 text-xs text-gray-700 shadow-sm hover:bg-gray-50"
          aria-label="Copy message"
        >
          <div className="flex items-center gap-1">
            <Clipboard className="h-3 w-3" />
            {copied ? 'Copied' : 'Copy'}
          </div>
        </button>
      </div>
    </div>
  )
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      <span>Thinking</span>
      <div className="inline-flex translate-y-[1px]">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="mx-[2px] inline-block h-[6px] w-[6px] rounded-full bg-gray-400/70"
            initial={{ opacity: 0.3, y: 0 }}
            animate={{ opacity: [0.3, 1, 0.3], y: [-1, 0, -1] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  )
}