import { Routes, Route } from 'react-router-dom';
import { TasksPage } from '@/components/TasksPage';
import { TaskPage } from '@/pages/TaskPage';
import { TaskChatPage } from '@/pages/TaskChatPage';
import { LoginPage } from '@/pages/LoginPage';
import PricingScreen from '@/pages/PricingPage';
import { ApiKeysForm } from '@/components/onboarding/ApiKeysForm';
import { DefaultRepoSelector } from '@/components/onboarding/DefaultRepoSelector';

interface RouterProps {
  isSignedIn: boolean;
  isLoaded: boolean;
}

export function Router({ isSignedIn }: RouterProps) {
  return (
    <Routes>
      <Route path="/pricing" element={<PricingScreen />} />
      {isSignedIn ? (
        <>
          <Route path="/" element={<TasksPage />} />
          <Route path="/tasks/:id" element={<TaskPage />} />
          <Route path="/tasks/:id/chat" element={<TaskChatPage />} />
          <Route path="/onboarding/api-keys" element={<ApiKeysForm />} />
          <Route path="/onboarding/default-repo" element={<DefaultRepoSelector />} />
        </>
      ) : (
        <Route path="*" element={<LoginPage />} />
      )}
    </Routes>
  );
}