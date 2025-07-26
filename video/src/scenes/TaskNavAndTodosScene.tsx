import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill
} from 'remotion';
import { realTodos } from '../mocks/mockData';

// Mock tasks for navigation
const mockTasks = [
  {
    id: 1,
    title: "JWT Authentication System",
    description: "Implement secure authentication with refresh tokens",
    status: "completed",
    todos: realTodos.slice(0, 3)
  },
  {
    id: 2,
    title: "Real-time Dashboard Components", 
    description: "Build interactive dashboard with live metrics",
    status: "in_progress",
    todos: realTodos.slice(3, 6)
  },
  {
    id: 3,
    title: "Mobile-First UI Architecture",
    description: "Design responsive system with touch components",
    status: "pending", 
    todos: realTodos.slice(6, 9)
  }
];

export const TaskNavAndTodosScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Navigation timing: each task focused for 30 frames (1 second)
  const currentTaskIndex = Math.floor(frame / 30) % mockTasks.length;
  const currentTask = mockTasks[currentTaskIndex];
  
  // Keypress animation - show j when moving down
  const keyPressFrame = frame % 30;
  const showKeyPress = keyPressFrame < 10;
  const keyOpacity = interpolate(keyPressFrame, [0, 5, 10], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Todo completion timing within each task
  const todoFrame = frame % 30;
  const completedTodos = Math.floor(todoFrame / 10); // One todo every 10 frames

  return (
    <AbsoluteFill style={{ backgroundColor: '#0e0e10' }}>
      {/* Keypress overlay */}
      {showKeyPress && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 60,
            opacity: keyOpacity,
            transform: `scale(${keyOpacity})`,
          }}
        >
          <div
            style={{
              backgroundColor: '#1f2937',
              border: '2px solid #7dd3fc',
              borderRadius: 8,
              padding: '12px 20px',
              boxShadow: '0 4px 16px rgba(125, 211, 252, 0.4)',
            }}
          >
            <div
              style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: 18,
                fontWeight: 600,
                color: '#7dd3fc',
              }}
            >
              j
            </div>
          </div>
        </div>
      )}

      {/* Main content container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '85%',
          height: '80%',
          backgroundColor: '#1f2937',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          display: 'flex',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Left side - Task list */}
        <div
          style={{
            width: '50%',
            padding: 32,
            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <h2
            style={{
              margin: 0,
              marginBottom: 24,
              fontSize: 20,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.9)',
            }}
          >
            Tasks
          </h2>

          {mockTasks.map((task, index) => {
            const isFocused = index === currentTaskIndex;
            
            return (
              <div
                key={task.id}
                style={{
                  padding: '16px 20px',
                  marginBottom: 12,
                  borderRadius: 12,
                  backgroundColor: isFocused ? '#374151' : 'transparent',
                  border: isFocused ? '1px solid #7dd3fc' : '1px solid transparent',
                  transform: isFocused ? 'scale(1.02)' : 'scale(1)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                {/* Vim cursor bar */}
                {isFocused && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3,
                      height: 32,
                      backgroundColor: '#7dd3fc',
                      borderRadius: 2,
                      boxShadow: '0 0 8px rgba(125, 211, 252, 0.6)',
                    }}
                  />
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Status indicator */}
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor:
                        task.status === 'completed'
                          ? '#22c55e'
                          : task.status === 'in_progress'
                          ? '#f59e0b'
                          : '#64748b',
                    }}
                  />

                  <div style={{ flex: 1 }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: isFocused ? 16 : 14,
                        fontWeight: isFocused ? 600 : 500,
                        color: isFocused ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.7)',
                        marginBottom: 4,
                      }}
                    >
                      {task.title}
                    </h3>
                    {isFocused && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: 'rgba(255, 255, 255, 0.6)',
                        }}
                      >
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right side - Todos */}
        <div
          style={{
            width: '50%',
            padding: 32,
          }}
        >
          <h2
            style={{
              margin: 0,
              marginBottom: 24,
              fontSize: 20,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.9)',
            }}
          >
            Todos
          </h2>

          {currentTask.todos.map((todo, index) => {
            const isCompleted = index < completedTodos;
            const isAnimating = index === completedTodos - 1 && todoFrame % 10 > 5;
            
            return (
              <div
                key={todo.todo_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  marginBottom: 8,
                  borderRadius: 8,
                  backgroundColor: isCompleted ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                  border: isAnimating ? '1px solid #22c55e' : '1px solid transparent',
                  transform: isAnimating ? 'scale(1.02)' : 'scale(1)',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Checkbox */}
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: isCompleted ? '2px solid #22c55e' : '2px solid #6b7280',
                    backgroundColor: isCompleted ? '#22c55e' : 'transparent',
                    marginRight: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isCompleted && (
                    <div
                      style={{
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 'bold',
                      }}
                    >
                      DONE
                    </div>
                  )}
                </div>

                {/* Todo text */}
                <div
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: isCompleted ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                    textDecoration: isCompleted ? 'line-through' : 'none',
                  }}
                >
                  {todo.content}
                </div>

                {/* Completion flash */}
                {isAnimating && (
                  <div
                    style={{
                      color: '#22c55e',
                      fontSize: 14,
                      marginLeft: 8,
                    }}
                  >
                    COMPLETE
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.6)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        j/k to navigate • {mockTasks.length} tasks
      </div>
    </AbsoluteFill>
  );
};