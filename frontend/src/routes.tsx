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
}

export function Router({ isSignedIn }: RouterProps) {
  return (
    <Routes>
      {isSignedIn ? (
        <>
          <Route path="/" element={<TasksPage />} />
          {/* New: Chat page is now the default detail route */}
          <Route path="/tasks/:id" element={<TaskChatPage />} />
          {/* Explicit chat route still works */}
          <Route path="/tasks/:id/chat" element={<TaskChatPage />} />
          {/* Legacy page accessible via /task/:id/old */}
          <Route path="/task/:id/old" element={<TaskPage />} />
          <Route path="/onboarding/api-keys" element={<ApiKeysForm />} />
          <Route path="/onboarding/default-repo" element={<DefaultRepoSelector />} />
          <Route path="/pricing" element={<PricingScreen />} />
        </>
      ) : (
        <>
          <Route path="/" element={<LoginPage />} />
          <Route path="/pricing" element={<PricingScreen />} />
        </>
      )}
    </Routes>
  );
}