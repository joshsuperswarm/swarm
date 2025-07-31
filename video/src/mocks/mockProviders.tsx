import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { taskDetail, mockTodos } from './index';
import { STATUSES } from '../types';

// Create a mock query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// Mock the query hooks
export const mockQueries = {
  useTasksQuery: () => ({
    data: [taskDetail],
    isLoading: false,
    error: null
  }),
  
  useTaskDetailsQuery: (taskId: number) => ({
    data: taskDetail,
    isLoading: false,
    error: null
  }),
  
  useTaskTodosQuery: (taskId: number) => ({
    data: mockTodos,
    isLoading: false,
    error: null
  })
};

// Mock React Router hooks
export const mockRouterHooks = {
  useParams: () => ({ id: '56' }),
  useNavigate: () => () => {},
};

// Mock other hooks
export const mockOtherHooks = {
  useHotkeys: () => {},
};

// Mock data exports
export const mockData = {
  statuses: STATUSES
};

interface MockProvidersProps {
  children: React.ReactNode;
}

export const MockProviders: React.FC<MockProvidersProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
          {children}
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
};