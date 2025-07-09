import { Routes, Route } from 'react-router-dom';
import { TasksPage } from '@/components/TasksPage';
import { TaskPage } from '@/pages/TaskPage';

interface RouterProps {
  onCreateTask?: () => void;
}

export function Router({ onCreateTask }: RouterProps = {}) {
  return (
    <Routes>
      <Route path="/" element={<TasksPage onCreateTask={onCreateTask} />} />
      <Route path="/tasks/:id" element={<TaskPage />} />
    </Routes>
  );
}