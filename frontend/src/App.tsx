import { useState, useEffect } from 'react'
import { UserButton, useAuth, useUser } from '@clerk/clerk-react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Layout } from './components/Layout'
import { Router } from './routes'
import { CreateTaskModal } from './components/CreateTaskModal'
import { ApiService } from './services/api'
import { useBackendApi } from '@/services/auth'
import { useUserStore } from './store/userStore'
import { useCreateTaskMutation } from '@/services/queries'
import './App.css'

function App() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const { loadUserProfile, clearUserProfile } = useUserStore()
  const createTask = useCreateTaskMutation()
  const api = useBackendApi()

  const handleTaskCreated = async (taskData: {
    description: string;
    repositoryId: number | null;
  }) => {
    try {
      if (!taskData.repositoryId) {
        console.error("Repository ID is required");
        return;
      }

      await createTask.mutateAsync({
        description: taskData.description,
        repository_id: taskData.repositoryId,
      });

      setIsCreateModalOpen(false);
      // Note: React Query will automatically invalidate and refetch tasks
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
        // Clear user data when signed out
        clearUserProfile()
        return
      }

      try {
        // Try to connect GitHub via backend (uses Clerk Management API)
        try {
          const githubAccount = user.externalAccounts?.find(account => account.provider === 'github')
          console.log('GitHub account found:', !!githubAccount)
          
          if (githubAccount) {
            console.log('→ Connecting GitHub via backend...')
            await api(token => ApiService.connectGitHub(token))
            console.log('✓ GitHub token retrieved and cached successfully')

            // Fetch user repositories from GitHub and cache them
            console.log('→ Fetching user repositories...')
            try {
              const repoResponse = await api(token => ApiService.getUserRepositories(token))
              console.log(`✓ Fetched ${repoResponse.count} repositories from GitHub`)
            } catch (repoError) {
              console.log('⚠ Could not fetch repositories:', repoError)
            }
          } else {
            console.log('ℹ No GitHub account connected - will show demo repositories')
          }
        } catch (tokenError) {
          console.log('⚠ Could not retrieve GitHub token:', tokenError)
          console.log('Will fall back to demo repositories')
        }

        // Load user profile data for global access
        console.log('→ Loading user profile...')
        await api(token => loadUserProfile(token))
        console.log('✓ User profile loaded and cached')
      } catch (error) {
        console.error('✗ Failed to handle authentication:', error)
      }
    })()
  }, [isSignedIn, user, loadUserProfile, clearUserProfile, api])

  // Global hotkey to close create task modal
  useHotkeys('esc', () => {
    if (isCreateModalOpen) {
      setIsCreateModalOpen(false);
    }
  }, {
    enabled: isCreateModalOpen
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Router isSignedIn={isSignedIn} isLoaded={isLoaded} />;
  }

  return (
    <Layout onCreateTask={() => setIsCreateModalOpen(true)}>
      <div className="flex flex-col h-full">
        <div className="bg-white border-b border-gray-200 px-6 flex-shrink-0" style={{paddingTop: '18px', paddingBottom: '18px'}}>
          <div className="flex justify-end items-center">
            <UserButton />
          </div>
        </div>

        <Router isSignedIn={isSignedIn} isLoaded={isLoaded} />
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
