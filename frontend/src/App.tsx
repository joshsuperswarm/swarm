import { useState, useEffect } from 'react'
import { SignInButton, UserButton, useAuth, useUser } from '@clerk/clerk-react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Layout } from './components/Layout'
import { Router } from './routes'
import { CreateTaskModal } from './components/CreateTaskModal'
import { ApiService } from './services/api'
import { setBackendJwt } from '@/lib/authToken'
import { useUserStore } from './store/userStore'
import './App.css'

function App() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const { isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  const { loadUserProfile, clearUserProfile } = useUserStore()

  const handleTaskCreated = async (taskData: {
    title: string;
    description: string;
    repositoryId: number | null;
  }) => {
    try {
      if (!taskData.repositoryId) {
        console.error("Repository ID is required");
        return;
      }

      await ApiService.createTask({
        title: taskData.title,
        description: taskData.description,
        repository_id: taskData.repositoryId,
      });

      setIsCreateModalOpen(false);
      // Note: TasksPage will auto-refresh via its polling mechanism
    } catch (err) {
      console.error("Failed to create task:", err);
      // TODO: Show error notification to user
      setIsCreateModalOpen(false);
    }
  };

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
        // Clear JWT and user data when signed out
        setBackendJwt(null)
        clearUserProfile()
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

        // 3. Load user profile data for global access
        console.log('→ Loading user profile...')
        await loadUserProfile()
        console.log('✓ User profile loaded and cached')
      } catch (error) {
        console.error('✗ Failed to handle authentication:', error)
      }
    })()
  }, [isSignedIn, getToken, user, loadUserProfile, clearUserProfile])

  // Global hotkey to close create task modal
  useHotkeys('esc', () => {
    if (isCreateModalOpen) {
      setIsCreateModalOpen(false);
    }
  }, {
    enabled: isCreateModalOpen
  });

  return (
    <Layout onCreateTask={() => setIsCreateModalOpen(true)}>
      <div className="flex flex-col h-full">
        <div className="bg-white border-b border-gray-200 px-6 flex-shrink-0" style={{paddingTop: '18px', paddingBottom: '18px'}}>
          <div className="flex justify-end items-center">
            {isSignedIn ? (
              <UserButton />
            ) : (
              <SignInButton mode="modal">
                <button className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
                  Sign in with GitHub
                </button>
              </SignInButton>
            )}
          </div>
        </div>

        <Router />
      </div>

      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateTask={handleTaskCreated}
      />
    </Layout>
  )
}

export default App
