import { useEffect } from 'react'
import { UserButton, useAuth, useUser } from '@clerk/clerk-react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Layout } from './components/Layout'
import { Router } from './routes'
import { CreateTaskModal } from './components/CreateTaskModal'
import { ApiService, type RunMode } from './services/api'
import { useBackendApi } from '@/services/auth'
import { useUserStore } from './store/userStore'
import { useModalStore } from './store/modalStore'
import { useCreateTaskMutation } from '@/services/queries'
import { useOnboarding } from '@/hooks/useOnboarding'
import { Edit } from 'lucide-react'
import swarmLogo from './assets/swarm-logo.png'
import './App.css'

function App() {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const { user: userData, loadUserProfile, clearUserProfile } = useUserStore()
  const { createTaskOpen, openCreateTask, closeCreateTask } = useModalStore()
  const createTask = useCreateTaskMutation()
  const api = useBackendApi()
  const { onboardingStatus, isLoading: onboardingLoading } = useOnboarding()

  // Extract default repository from user data (single source of truth)
  const defaultRepository = userData?.default_repo ?? null

  const handleTaskCreated = async (taskData: {
    description: string;
    repositoryId: number | null;
    mode: RunMode;
  }) => {
    try {
      if (!taskData.repositoryId) {
        console.error("Repository ID is required");
        return;
      }

      await createTask.mutateAsync({
        description: taskData.description,
        repository_id: taskData.repositoryId,
        mode: taskData.mode,
      });

      closeCreateTask();
      // Note: React Query will automatically invalidate and refetch tasks
    } catch (err) {
      console.error("Failed to create task:", err);
      // TODO: Show error notification to user
      closeCreateTask();
    }
  };


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
            console.log('GitHub token retrieved and cached successfully')

            // Fetch user repositories from GitHub and cache them
            console.log('→ Fetching user repositories...')
            try {
              const repoResponse = await api(token => ApiService.getUserRepositories(token))
              console.log(`Fetched ${repoResponse.count} repositories from GitHub`)
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
        console.log('User profile loaded and cached')
      } catch (error) {
        console.error('✗ Failed to handle authentication:', error)
      }
    })()
  }, [isSignedIn, user, loadUserProfile, clearUserProfile, api])

  // Global hotkeys - guard against opening multiple times
  useHotkeys('c', () => {
    if (!createTaskOpen) {
      openCreateTask();
    }
  });

  if (!isLoaded || (isSignedIn && onboardingLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Router isSignedIn={isSignedIn} />;
  }

  // If user hasn't completed onboarding, show onboarding without layout
  if (onboardingStatus && !onboardingStatus.onboarding_completed) {
    return <Router isSignedIn={isSignedIn} />;
  }

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <nav className="bg-white border-b border-gray-200 px-6 flex-shrink-0" style={{paddingTop: '18px', paddingBottom: '18px'}}>
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <img 
                src={swarmLogo} 
                alt="Swarm" 
                className="h-5 w-auto mr-3"
              />
              <h1 className="text-xl font-bold text-gray-900">Swarm</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (!createTaskOpen) {
                    openCreateTask();
                  }
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                title="Create new task (c)"
              >
                <Edit className="w-4 h-4" />
              </button>
              <UserButton />
            </div>
          </div>
        </nav>

        <Router isSignedIn={isSignedIn} />
      </div>

      <CreateTaskModal
        isOpen={createTaskOpen}
        onClose={closeCreateTask}
        onCreateTask={handleTaskCreated}
        defaultRepository={defaultRepository}
      />
    </Layout>
  )
}

export default App
