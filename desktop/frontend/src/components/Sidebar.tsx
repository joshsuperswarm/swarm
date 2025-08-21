import { useState, useRef, useEffect } from 'react'
import { useConversationsStore } from '../store/useConversationsStore'
import { Conversation } from '../types'
import { formatDistanceToNow } from 'date-fns'
import { AnimatedTitle } from './AnimatedTitle'

interface ContextMenuProps {
  show: boolean
  x: number
  y: number
  conversation: Conversation | null
  onClose: () => void
  onArchive: () => void
  onUnarchive: () => void
  onDelete: () => void
}

function ContextMenu({ 
  show, 
  x, 
  y, 
  conversation, 
  onClose, 
  onArchive, 
  onUnarchive, 
  onDelete 
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (show) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [show, onClose])

  if (!show || !conversation) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-32"
      style={{ left: x, top: y }}
    >
      {conversation.archived ? (
        <button
          onClick={onUnarchive}
          className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors"
        >
          Unarchive
        </button>
      ) : (
        <button
          onClick={onArchive}
          className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors"
        >
          Archive
        </button>
      )}
      <button
        onClick={onDelete}
        className="w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 transition-colors"
      >
        Delete
      </button>
    </div>
  )
}

interface ConversationItemProps {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent, conversation: Conversation) => void
}

function ConversationItem({ 
  conversation, 
  isActive, 
  onClick, 
  onContextMenu 
}: ConversationItemProps) {
  const timeAgo = formatDistanceToNow(new Date(conversation.updatedAt), { 
    addSuffix: true 
  })

  return (
    <div
      className={`
        px-3 py-2 cursor-pointer rounded-md transition-colors
        ${isActive 
          ? 'bg-blue-100 text-blue-900 border-l-2 border-blue-500' 
          : 'hover:bg-gray-100 text-gray-700'
        }
        ${conversation.isStreaming ? 'animate-pulse' : ''}
      `}
      onClick={onClick}
      onContextMenu={(e) => onContextMenu(e, conversation)}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            <AnimatedTitle
              title={conversation.titlePending ? "Generating title…" : conversation.title}
              isAnimating={conversation.titlePending || false}
              className=""
            />
          </div>
          <div className="text-xs text-gray-500 truncate">
            {timeAgo}
          </div>
        </div>
        {conversation.isStreaming && (
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        )}
      </div>
    </div>
  )
}

export default function Sidebar() {
  const { 
    conversations, 
    activeId, 
    createConversation, 
    setActive, 
    archiveConversation, 
    unarchiveConversation, 
    deleteConversation 
  } = useConversationsStore()
  
  const [contextMenu, setContextMenu] = useState<{
    show: boolean
    x: number
    y: number
    conversation: Conversation | null
  }>({ show: false, x: 0, y: 0, conversation: null })

  const [showArchived, setShowArchived] = useState(false)

  const activeConversations = conversations
    .filter(c => !c.archived)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  const archivedConversations = conversations
    .filter(c => c.archived)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  const handleNewChat = () => {
    const newId = createConversation()
    setActive(newId)
  }

  const handleContextMenu = (e: React.MouseEvent, conversation: Conversation) => {
    e.preventDefault()
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      conversation
    })
  }

  const handleCloseContextMenu = () => {
    setContextMenu({ show: false, x: 0, y: 0, conversation: null })
  }

  const handleArchive = () => {
    if (contextMenu.conversation) {
      archiveConversation(contextMenu.conversation.id)
    }
    handleCloseContextMenu()
  }

  const handleUnarchive = () => {
    if (contextMenu.conversation) {
      unarchiveConversation(contextMenu.conversation.id)
    }
    handleCloseContextMenu()
  }

  const handleDelete = () => {
    if (contextMenu.conversation) {
      if (confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
        deleteConversation(contextMenu.conversation.id)
      }
    }
    handleCloseContextMenu()
  }

  return (
    <div className="w-64 h-full bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={handleNewChat}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <span>+</span>
          <span>New Chat</span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Active Conversations */}
        {activeConversations.length > 0 && (
          <div className="space-y-1">
            {activeConversations.map(conversation => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={activeId === conversation.id}
                onClick={() => setActive(conversation.id)}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        )}

        {/* Archived Section */}
        {archivedConversations.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="w-full text-left px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors flex items-center justify-between"
            >
              <span>Archived ({archivedConversations.length})</span>
              <span className={`transform transition-transform ${showArchived ? 'rotate-180' : ''}`}>
                ↓
              </span>
            </button>

            {showArchived && (
              <div className="mt-2 space-y-1">
                {archivedConversations.map(conversation => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={activeId === conversation.id}
                    onClick={() => setActive(conversation.id)}
                    onContextMenu={handleContextMenu}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Menu */}
      <ContextMenu
        show={contextMenu.show}
        x={contextMenu.x}
        y={contextMenu.y}
        conversation={contextMenu.conversation}
        onClose={handleCloseContextMenu}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onDelete={handleDelete}
      />
    </div>
  )
}