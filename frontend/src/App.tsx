import { useState, useEffect } from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import { TasksPage } from './components/TasksPage'
import { CreateSessionModal } from './components/CreateSessionModal'
import { ApiService } from './services/api'
import './App.css'

function App() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Test backend connection on app load
  useEffect(() => {
    const testConnection = async () => {
      try {
        const health = await ApiService.healthCheck()
        console.log('✅ Backend connection successful:', health)
      } catch (error) {
        console.error('❌ Backend connection failed:', error)
      }
    }
    
    testConnection()
  }, [])

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Swarm</h1>
          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Sign in with Google
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </header>

      <SignedOut>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              AI Agent Session Manager
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Chat with Claude Code and manage your AI coding sessions
            </p>
            <div className="bg-white rounded-lg shadow-sm p-8">
              <p className="text-gray-600 mb-4">
                Please sign in to start chatting with Claude Code.
              </p>
              <SignInButton mode="modal">
                <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Get Started
                </button>
              </SignInButton>
            </div>
          </div>
        </main>
      </SignedOut>

      <SignedIn>
        <TasksPage />
      </SignedIn>

      <CreateSessionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  )
}

export default App
