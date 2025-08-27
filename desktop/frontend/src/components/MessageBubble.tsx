import React, { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { ChatMessage } from '../types'
import { FileCode, Clipboard, Folder, Loader2, Send, TerminalSquare } from 'lucide-react'
import { motion } from 'framer-motion'
import Markdown from './Markdown'
import { buildClaudeCommand } from '../utils/cli'

interface MessageBubbleProps {
  message: ChatMessage
  streaming?: boolean
}

function MessageBubbleImpl({ message, streaming }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [claudeCopied, setClaudeCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentOk, setSentOk] = useState<null | boolean>(null)
  const isThinking = !isUser && streaming && (message.content?.length ?? 0) === 0

  const copyAll = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const copyClaude = async () => {
    const content = message.content ?? ''
    if (!content.trim()) return

    // Build a single-arg CLI command (newlines collapsed).
    const cmd = buildClaudeCommand(content, { collapse: true })
    await navigator.clipboard.writeText(cmd)

    setClaudeCopied(true)
    setTimeout(() => setClaudeCopied(false), 1200)
  }

  const sendToSwarm = async () => {
    if (!message.content?.trim()) return
    try {
      setSending(true)
      setSentOk(null)
      await invoke('swarm_send_message', { text: message.content })
      setSentOk(true)
    } catch (e) {
      console.error('Send to Swarm failed:', e)
      setSentOk(false)
    } finally {
      setSending(false)
      setTimeout(() => setSentOk(null), 1500)
    }
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

          {/* Images display */}
          {isUser && message.images?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.images.map((img, i) => (
                <div key={i} className="relative group/img">
                  <img 
                    src={img.data} 
                    alt={img.name}
                    className="h-16 w-16 object-cover rounded-md border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(img.data, '_blank')}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-1 py-0.5 rounded-b-md opacity-0 group-hover/img:opacity-100 transition-opacity">
                    {img.name}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Files display */}
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

          {/* Citations display */}
          {!isUser && message.citations?.length ? (
            <div className="mt-3">
              <hr className="border-t border-gray-200 mb-2" />
              <div className="text-xs text-gray-600 font-medium mb-1">
                Sources
              </div>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                {message.citations.map((c, idx) => (
                  <li key={`${c.url}-${idx}`}>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline
                                 decoration-1 underline-offset-2"
                      title={c.title ?? c.url}
                    >
                      {c.domain}
                    </a>
                    {c.title ? (
                      <span className="text-gray-600"> — {c.title}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>

        {/* Hover actions */}
        <div className="absolute top-2 right-2 hidden group-hover:flex gap-2">
          <button
            onClick={sendToSwarm}
            className="rounded-md border border-gray-200 bg-white
                       h-6 px-2 text-xs text-gray-700 shadow-sm
                       hover:bg-gray-50 disabled:opacity-50"
            aria-label="Send to Swarm"
            disabled={sending}
            title="Create a Swarm chat task with this message"
          >
            <div className="flex items-center gap-1">
              {sending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              {sentOk === true ? 'Sent' : sentOk === false ? 'Error' : 'Send'}
            </div>
          </button>

          {/* Copy Claude (new) */}
          {!isUser && (
            <button
              onClick={copyClaude}
              className="rounded-md border border-gray-200 bg-white
                         h-6 px-2 text-xs text-gray-700 shadow-sm
                         hover:bg-gray-50"
              aria-label="Copy Claude command"
              title="Copy as: claude &quot;&lt;message&gt;&quot;"
            >
              <div className="flex items-center gap-1">
                <TerminalSquare className="h-3 w-3" />
                {claudeCopied ? 'Copied' : 'Claude'}
              </div>
            </button>
          )}

          <button
            onClick={copyAll}
            className="rounded-md border border-gray-200 bg-white
                       h-6 px-2 text-xs text-gray-700 shadow-sm
                       hover:bg-gray-50"
            aria-label="Copy message"
          >
            <div className="flex items-center gap-1">
              <Clipboard className="h-3 w-3" />
              {copied ? 'Copied' : 'Copy'}
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

const MessageBubble = React.memo(
  MessageBubbleImpl,
  (prev, next) =>
    prev.message === next.message && prev.streaming === next.streaming
)

export default MessageBubble

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