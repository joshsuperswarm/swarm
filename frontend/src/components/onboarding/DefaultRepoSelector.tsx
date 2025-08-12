import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { OnboardingService } from '@/services/onboarding';
import { ApiService } from '@/services/api';
import { useBackendApi } from '@/services/auth';
import { useUserStore } from '@/store/userStore';
import { OnboardingLayout } from './OnboardingLayout';
import type { RepositoryWithTasks } from '@/types/generated/RepositoryWithTasks';

export function DefaultRepoSelector() {
  const [repositories, setRepositories] = useState<RepositoryWithTasks[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const api = useBackendApi();
  const { refreshUserProfile } = useUserStore();

  useEffect(() => {
    const loadRepositories = async () => {
      try {
        const response = await api(token => ApiService.getUserRepositories(token));
        setRepositories(response.repositories);
      } catch (err) {
        console.error('Failed to load repositories:', err);
        setError('Failed to load repositories. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadRepositories();
  }, [api]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepoId) {
      setError('Please select a repository');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api(async (token) => {
        await OnboardingService.setDefaultRepo(token, {
          repository_id: selectedRepoId,
        });
      });
      
      // Refresh user profile to get the updated default repository
      await api(token => refreshUserProfile(token));
      
      // Navigate to main app
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Failed to set default repository:', err);
      setError('Failed to set default repository. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <OnboardingLayout 
        currentStep="default-repo"
        title="Select your default repository"
      >
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Loading your repositories...</p>
        </div>
      </OnboardingLayout>
    );
  }

  if (repositories.length === 0) {
    return (
      <OnboardingLayout 
        currentStep="default-repo"
        title="No repositories found"
      >
        <div className="text-center py-8">
          <p className="text-sm text-gray-600 mb-4">
            We couldn't find any repositories in your GitHub account.
          </p>
          <Button 
            onClick={() => window.location.reload()}
            variant="outline"
          >
            Refresh
          </Button>
        </div>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout 
      currentStep="default-repo"
      title="Choose which repository to use by default for new tasks"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {repositories.map((repo) => (
            <label
              key={repo.id}
              className={`
                flex items-center p-3 border rounded-lg cursor-pointer transition-colors
                ${selectedRepoId === repo.id 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
              style={{ position: 'relative' }}
            >
              {/* Keep the input focusable but prevent layout/scroll jumps */}
              <input
                type="radio"
                name="repository"
                value={repo.id}
                checked={selectedRepoId === repo.id}
                onChange={() => setSelectedRepoId(repo.id)}
                className="absolute opacity-0"
                style={{
                  // ensure it sits inside the label's box so the browser doesn't scroll
                  inset: 0,
                  pointerEvents: 'none',
                }}
              />
              <div className={`
                w-4 h-4 rounded-full border-2 flex items-center justify-center mr-3
                ${selectedRepoId === repo.id 
                  ? 'border-blue-500' 
                  : 'border-gray-300'
                }
              `}>
                {selectedRepoId === repo.id && (
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {repo.full_name}
                </div>
                {repo.is_private && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 mt-1">
                    Private
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <Button 
          type="submit" 
          disabled={!selectedRepoId || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? 'Setting up...' : 'Complete Setup'}
        </Button>
      </form>
    </OnboardingLayout>
  );
}