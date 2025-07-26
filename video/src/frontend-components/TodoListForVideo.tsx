import { useCurrentFrame } from 'remotion';
import { Circle } from 'lucide-react';
import type { AgentTodo } from "../types/AgentTodo";

interface TodoListProps {
  todos: AgentTodo[];
  loading?: boolean;
}


export function TodoListForVideo({ todos, loading }: TodoListProps) {
  const frame = useCurrentFrame();
  
  // Animation timing: each todo completes every 30 frames (1 second at 30fps)
  const getAnimatedStatus = (index: number, originalStatus: string) => {
    const completionFrame = 30 + (index * 30); // Start after 1 second, then every second
    const shouldBeCompleted = frame >= completionFrame;
    
    if (originalStatus === 'completed' && shouldBeCompleted) {
      return 'completed';
    } else if (originalStatus === 'completed' && !shouldBeCompleted) {
      return 'pending'; // Show as pending until it's time to complete
    } else if (originalStatus === 'in_progress') {
      // Handle in_progress todos - complete them too
      return shouldBeCompleted ? 'completed' : 'in_progress';
    }
    return originalStatus;
  };

  // Get completion animation progress for visual effects
  const getCompletionProgress = (index: number) => {
    const completionFrame = 30 + (index * 30);
    const animationDuration = 15; // 0.5 second animation
    
    if (frame < completionFrame) return 0;
    if (frame >= completionFrame + animationDuration) return 1;
    
    return (frame - completionFrame) / animationDuration;
  };

  if (loading) {
    return (
      <div>
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: '6px',
          padding: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              border: '1px solid #E5E7EB',
              borderTop: '1px solid hsl(222, 90%, 55%)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <span style={{ fontSize: '14px', color: '#6B7280' }}>Loading todos...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '24px' }}>
      {todos.length === 0 ? (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: '6px',
          padding: '8px'
        }}>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>No todos yet</p>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: '6px',
          padding: '4px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {todos.map((todo) => (
              <div
                key={todo.todo_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px 4px',
                  borderRadius: '2px',
                  color: todo.status === "completed" ? '#6B7280' : 'hsl(240, 5%, 10%)',
                  fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <Circle
                    size={22}
                    strokeWidth={2}
                    style={{ fill: todo.status === 'completed' ? '#6B7280' : 'none' }}
                  />
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '14px',
                    fontWeight: 'normal',
                    lineHeight: 1.25,
                    margin: 0,
                    textDecoration: todo.status === "completed" ? 'line-through' : 'none'
                  }}>
                    {todo.content}
                  </p>
                  
                  {todo.updated_at && (
                    <p style={{
                      fontSize: '12px',
                      color: '#6B7280',
                      marginTop: '4px',
                      margin: 0
                    }}>
                      Updated {new Date(todo.updated_at).toLocaleString()}
                    </p>
                  )}
                </div>
                
                <div style={{ flexShrink: 0 }}>
                  <span style={{
                    fontSize: '12px',
                    color: '#6B7280',
                    fontWeight: 'normal'
                  }}>
                    {todo.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}