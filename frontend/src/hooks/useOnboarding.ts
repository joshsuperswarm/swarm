import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { OnboardingService } from '@/services/onboarding';
import { useBackendApi } from '@/services/auth';
import type { OnboardingStatus } from '@/types/onboarding';

export function useOnboarding() {
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const api = useBackendApi();

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const status = await api(token => OnboardingService.getOnboardingStatus(token));
        setOnboardingStatus(status);
        
        // Only redirect if not already on an onboarding route
        if (!location.pathname.startsWith('/onboarding/')) {
          if (!status.onboarding_completed) {
            if (status.step === 'api-keys') {
              navigate('/onboarding/api-keys', { replace: true });
            } else if (status.step === 'default-repo') {
              navigate('/onboarding/default-repo', { replace: true });
            }
          }
        }
      } catch (err) {
        console.error('Failed to check onboarding status:', err);
        setError('Failed to load onboarding status');
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboarding();
  }, [api, navigate, location.pathname]);

  const refreshStatus = async () => {
    try {
      setIsLoading(true);
      const status = await api(token => OnboardingService.getOnboardingStatus(token));
      setOnboardingStatus(status);
    } catch (err) {
      console.error('Failed to refresh onboarding status:', err);
      setError('Failed to refresh onboarding status');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    onboardingStatus,
    isLoading,
    error,
    refreshStatus,
  };
}