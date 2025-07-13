import { Routes, Route } from 'react-router-dom';
import { TasksPage } from '@/components/TasksPage';
import { TaskPage } from '@/pages/TaskPage';
import { LoginPage } from '@/pages/LoginPage';

interface RouterProps {
  isSignedIn: boolean;
  isLoaded: boolean;
}

export function Router({ isSignedIn }: RouterProps) {
  if (!isSignedIn) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<TasksPage />} />
      <Route path="/tasks/:id" element={<TaskPage />} />
    </Routes>
  );
}