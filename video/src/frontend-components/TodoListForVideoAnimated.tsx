import { useCurrentFrame } from 'remotion';
import type { AgentTodo } from "../types/AgentTodo";

interface TodoListProps {
  todos: AgentTodo[];
  loading?: boolean;
  getTodoSpring?: (index: number) => number;
}

// Status dot styles - matching real TodoList component
const getStatusDotStyle = (status: string) => {
  switch (status) {
    case 'completed': 
      return { 
        border: '1px solid #6B7280', 
        backgroundColor: '#6B7280' 
      };
    case 'in_progress': 
      return { 
        border: '1px solid hsl(222, 90%, 55%)', 
        backgroundColor: 'transparent' 
      };
    case 'pending': 
      return { 
        border: '1px solid #D1D5DB', 
        backgroundColor: 'transparent' 
      };
    default: 
      return { 
        border: '1px solid #D1D5DB', 
        backgroundColor: 'transparent' 
      };
  }
};

export function TodoListForVideoAnimated({ todos, loading, getTodoSpring }: TodoListProps) {
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
            {todos.map((todo, index) => {
              const animatedStatus = getAnimatedStatus(index, todo.status);
              const completionProgress = getCompletionProgress(index);
              const isCompleting = completionProgress > 0 && completionProgress < 1;
              const justCompleted = completionProgress === 1 && frame <= 30 + (index * 30) + 30; // Highlight for 1 second after completion
              
              // Enhanced spring animation
              const s = getTodoSpring ? getTodoSpring(index) : 1;
              const flash = isCompleting ? (1 - completionProgress) : 0;
              
              return (
                <div
                  key={todo.todo_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 4px',
                    borderRadius: '2px',
                    color: animatedStatus === "completed" ? '#6B7280' : 'hsl(240, 5%, 10%)',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    backgroundColor: justCompleted ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                    opacity: s,
                    transform: `
                      translateX(${(1 - s) * 50}px)
                      scale(${0.96 + s * 0.04})
                    `,
                    filter: `drop-shadow(0 2px 6px rgba(0,0,0,${0.15 * s}))`,
                    transition: 'all 0.2s',
                    position: 'relative',
                    boxShadow: animatedStatus === 'completed' && flash > 0 
                      ? `0 0 0 3px rgba(34,197,94,${flash})` 
                      : undefined
                  }}
                >
                  <div style={{ flexShrink: 0 }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      ...getStatusDotStyle(animatedStatus),
                      transform: isCompleting ? `scale(${1 + completionProgress * 0.3})` : 'scale(1)'
                    }} />
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: 'normal',
                      lineHeight: 1.25,
                      margin: 0,
                      textDecoration: animatedStatus === "completed" ? 'line-through' : 'none',
                      opacity: isCompleting ? 0.7 + (completionProgress * 0.3) : 1
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
                      {animatedStatus.replace('_', ' ')}
                    </span>
                  </div>
                  
                  {/* Completion checkmark animation */}
                  {isCompleting && (
                    <div style={{
                      position: 'absolute',
                      right: '8px',
                      fontSize: '16px',
                      color: '#22C55E',
                      opacity: completionProgress,
                      transform: `scale(${completionProgress})`,
                      pointerEvents: 'none'
                    }}>
                      DONE
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}