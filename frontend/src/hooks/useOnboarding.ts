import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOnboardingStatusQuery } from '@/services/queries';

export function useOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: onboardingStatus, isLoading, error, refetch: refreshStatus } = useOnboardingStatusQuery();

  useEffect(() => {
    // Only redirect if not already on an onboarding route and we have status data
    if (onboardingStatus && !location.pathname.startsWith('/onboarding/')) {
      if (!onboardingStatus.onboarding_completed) {
        if (onboardingStatus.step === 'api-keys') {
          navigate('/onboarding/api-keys', { replace: true });
        } else if (onboardingStatus.step === 'default-repo') {
          navigate('/onboarding/default-repo', { replace: true });
        }
      }
    }
  }, [onboardingStatus, navigate, location.pathname]);

  return {
    onboardingStatus,
    isLoading,
    error,
    refreshStatus,
  };
}