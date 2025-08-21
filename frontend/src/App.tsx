import { useEffect } from 'react'
import { UserButton, useAuth, useUser } from '@clerk/clerk-react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Layout } from './components/Layout'
import { Router } from './routes'
import { CreateTaskModal } from './components/CreateTaskModal'
import ApiKeysPanel from './components/account/ApiKeysPanel'
import { ApiService, type RunMode, type ClaudeModel } from './services/api'
import { useBackendApi } from '@/services/auth'
import { useModalStore } from './store/modalStore'
import { useCreateTaskMutation, useUserProfileQuery } from '@/services/queries'
import { useOnboarding } from '@/hooks/useOnboarding'
import { Edit } from 'lucide-react'
import swarmLogo from './assets/swarm-logo.png'
import './App.css'

function App() {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const { data: profile } = useUserProfileQuery()
  const { createTaskOpen, openCreateTask, closeCreateTask } = useModalStore()
  const createTask = useCreateTaskMutation()
  const api = useBackendApi()
  const { onboardingStatus, isLoading: onboardingLoading } = useOnboarding()

  // Extract default repository from profile data (single source of truth)
  const defaultRepository = profile?.default_repo ?? null

  const handleTaskCreated = async (taskData: {
    description: string;
    repositoryId: number | null;
    mode: RunMode;
    model: ClaudeModel;
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
        model: taskData.model,
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
      if (!isSignedIn || !user) return

      try {
        const githubAccount = user.externalAccounts?.find(
          a => a.provider === 'github'
        )
        if (githubAccount) {
          // fire-and-forget; don't await before rendering
          api(token => ApiService.connectGitHub(token)).catch(() => {})
          api(token => ApiService.getUserRepositories(token)).catch(() => {})
        }
      } catch (error) {
        console.log('Failed to connect GitHub or fetch repositories:', error)
      }
    })()
  }, [isSignedIn, user, api])

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
              <UserButton>
                <UserButton.UserProfilePage label="API Keys" url="api-keys" labelIcon="🔑">
                  <ApiKeysPanel />
                </UserButton.UserProfilePage>
              </UserButton>
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
