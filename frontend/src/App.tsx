import { useState, useEffect } from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth, useUser } from '@clerk/clerk-react'
import { TasksPage } from './components/TasksPage'
import { CreateSessionModal } from './components/CreateSessionModal'
import { ApiService } from './services/api'
import { setBackendJwt } from '@/lib/authToken'
import './App.css'

function App() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const { isSignedIn, getToken } = useAuth()
  const { user } = useUser()

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

  // Handle Clerk authentication and GitHub token storage
  useEffect(() => {
    (async () => {
      if (!isSignedIn || !user) {
        // Clear JWT when signed out
        setBackendJwt(null)
        return
      }

      try {
        // 1. Save Clerk session JWT for later API calls
        const jwt = await getToken()
        setBackendJwt(jwt ?? null)

        // 2. Try to connect GitHub via backend (uses Clerk Management API)
        try {
          const githubAccount = user.externalAccounts?.find(account => account.provider === 'github')
          console.log('GitHub account found:', !!githubAccount)
          
          if (githubAccount) {
            console.log('→ Connecting GitHub via backend...')
            await ApiService.connectGitHub()
            console.log('✓ GitHub token retrieved and cached successfully')
          } else {
            console.log('ℹ No GitHub account connected - will show demo repositories')
          }
        } catch (tokenError) {
          console.log('⚠ Could not retrieve GitHub token:', tokenError)
          console.log('Will fall back to demo repositories')
        }
      } catch (error) {
        console.error('✗ Failed to handle authentication:', error)
      }
    })()
  }, [isSignedIn, getToken, user])

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
              <button className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
                Sign in with GitHub
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </header>

      <SignedOut>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              AI Agent Task Manager
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Create tasks for AI agents to work on your GitHub repositories
            </p>
            <div className="bg-white rounded-lg shadow-sm p-8">
              <p className="text-gray-600 mb-4">
                Sign in with GitHub to start creating AI agent tasks for your repositories.
              </p>
              <SignInButton mode="modal">
                <button className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
                  Continue with GitHub
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
