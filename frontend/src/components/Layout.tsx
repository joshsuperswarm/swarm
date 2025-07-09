import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

interface LayoutProps {
  children: ReactNode
  onCreateTask?: () => void
}

export function Layout({ children, onCreateTask }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar onCreateTask={onCreateTask} />
      <main className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  )
}