import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Edit } from 'lucide-react'

interface SidebarProps {
  onCreateTask?: () => void
}

export function Sidebar({ onCreateTask }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Toggle sidebar with cmd+b
  useHotkeys('cmd+b', () => {
    setIsCollapsed(prev => !prev)
  }, {
    preventDefault: true
  })

  // Create task with 'c' key
  useHotkeys('c', () => {
    if (onCreateTask) {
      onCreateTask()
    }
  }, {
    enabled: !!onCreateTask
  })

  return (
    <div className={`
      flex flex-col bg-white border-r border-gray-200 transition-all duration-200 ease-in-out
      ${isCollapsed ? 'w-16' : 'w-60'}
    `}>
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center mr-3">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            {!isCollapsed && (
              <h1 className="text-xl font-bold text-gray-900">Swarm</h1>
            )}
          </div>
          {onCreateTask && (
            <button
              onClick={onCreateTask}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Create new task"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4">
        <div className="space-y-2">
          <div className={`
            relative flex items-center px-3 py-2 text-gray-700 rounded-lg bg-gray-100
            ${isCollapsed ? 'justify-center' : ''}
            active:before:absolute active:before:inset-y-0
            active:before:left-0 active:before:w-[3px]
            active:before:bg-gray-800
          `}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            {!isCollapsed && <span className="font-medium">Tasks</span>}
          </div>
        </div>
      </nav>

    </div>
  )
}