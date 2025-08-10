import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
  onCreateTask?: () => void
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden safe-pt">
        {children}
      </main>
    </div>
  )
}