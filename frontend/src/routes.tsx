import { Routes, Route } from 'react-router-dom';
import { TasksPage } from '@/components/TasksPage';
import { TaskPage } from '@/pages/TaskPage';

export function Router() {
  return (
    <Routes>
      <Route path="/" element={<TasksPage />} />
      <Route path="/tasks/:id" element={<TaskPage />} />
    </Routes>
  );
}