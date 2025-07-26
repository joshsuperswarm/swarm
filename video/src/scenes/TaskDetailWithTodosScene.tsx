import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  spring
} from 'remotion';
import { realTodos } from '../mocks/mockData';

// Mock tasks for the detail view
const mockTasks = [
  {
    id: 1,
    title: "JWT Authentication System",
    description: "Implement secure JWT-based authentication with refresh tokens, user session management, and proper token validation middleware.",
    status: "completed"
  },
  {
    id: 2,
    title: "Real-time Dashboard Components", 
    description: "Build interactive dashboard with live metrics, WebSocket connections, and responsive data visualization charts.",
    status: "in_progress"
  },
  {
    id: 3,
    title: "Mobile-First UI Architecture",
    description: "Design responsive system with touch-friendly components, gesture handling, and progressive enhancement for mobile devices.",
    status: "pending"
  }
];

// Map todos to tasks
const todosForTask = (index: number) => 
  realTodos.slice(index * 3, index * 3 + 3);

export const TaskDetailWithTodosScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Each task gets 90 frames (3 seconds)
  const taskDuration = 90;
  const currentTaskIndex = Math.floor(frame / taskDuration);
  const taskFrame = frame % taskDuration;
  
  const currentTask = mockTasks[currentTaskIndex] || mockTasks[mockTasks.length - 1];
  const currentTodos = todosForTask(currentTaskIndex);

  // Task card animations
  const taskFadeIn = interpolate(taskFrame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const taskFadeOut = interpolate(taskFrame, [75, 85], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const taskSlideOut = interpolate(taskFrame, [75, 85], [0, -100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const taskOpacity = Math.min(taskFadeIn, taskFadeOut);

  // Todo animations - stagger in, then complete
  const getTodoAnimation = (todoIndex: number) => {
    const staggerDelay = 15 + (todoIndex * 15); // Start at frame 15, stagger by 15 frames
    const completeDelay = staggerDelay + 30; // Complete 30 frames after appearing
    
    const fadeIn = interpolate(taskFrame, [staggerDelay, staggerDelay + 10], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    const isCompleted = taskFrame >= completeDelay;
    const completionFlash = interpolate(taskFrame, [completeDelay, completeDelay + 5], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    return { fadeIn, isCompleted, completionFlash };
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#0e0e10' }}>
      {/* Main task detail container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) translateX(${taskSlideOut}px)`,
          width: width * 0.8,
          height: height * 0.8,
          backgroundColor: '#111315',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          padding: 48,
          opacity: taskOpacity,
          fontFamily: 'system-ui, sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* Task header */}
        <div
          style={{
            marginBottom: 32,
            paddingBottom: 20,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: '#7dd3fc',
              }}
            >
              #{currentTask.id}
            </div>
            <div
              style={{
                padding: '4px 12px',
                backgroundColor: 
                  currentTask.status === 'completed' ? '#22c55e' : 
                  currentTask.status === 'in_progress' ? '#f59e0b' : '#64748b',
                color: '#ffffff',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              {currentTask.status}
            </div>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.95)',
              marginBottom: 16,
              lineHeight: 1.3,
            }}
          >
            {currentTask.title}
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: 18,
              lineHeight: 1.5,
              color: 'rgba(255, 255, 255, 0.8)',
              maxHeight: 80,
              overflow: 'hidden',
            }}
          >
            {currentTask.description.length > 120 
              ? currentTask.description.substring(0, 120) + '...'
              : currentTask.description
            }
          </p>
        </div>

        {/* Todos section */}
        <div>
          <h3
            style={{
              margin: 0,
              marginBottom: 20,
              fontSize: 20,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.9)',
            }}
          >
            Tasks
          </h3>

          {currentTodos.map((todo, index) => {
            const animation = getTodoAnimation(index);
            
            return (
              <div
                key={todo.todo_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  marginBottom: 12,
                  backgroundColor: animation.isCompleted ? 'rgba(34, 197, 94, 0.1)' : '#1a1b1e',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  opacity: animation.fadeIn,
                  transform: `translateY(${(1 - animation.fadeIn) * 20}px)`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Completion flash overlay */}
                {animation.completionFlash > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: `rgba(34, 197, 94, ${animation.completionFlash * 0.3})`,
                      borderRadius: 8,
                    }}
                  />
                )}

                {/* Checkbox */}
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: animation.isCompleted ? '2px solid #22c55e' : '2px solid #6b7280',
                    backgroundColor: animation.isCompleted ? '#22c55e' : 'transparent',
                    marginRight: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {animation.isCompleted && (
                    <div
                      style={{
                        color: '#ffffff',
                        fontSize: 12,
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
                    fontSize: 15,
                    color: animation.isCompleted 
                      ? 'rgba(255, 255, 255, 0.6)' 
                      : 'rgba(255, 255, 255, 0.85)',
                    textDecoration: animation.isCompleted ? 'line-through' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {todo.content}
                </div>

                {/* Completion indicator */}
                {animation.isCompleted && animation.completionFlash > 0 && (
                  <div
                    style={{
                      color: '#22c55e',
                      fontSize: 16,
                      marginLeft: 12,
                      opacity: animation.completionFlash,
                    }}
                  >
                    COMPLETE
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Subtle background accent */}
        <div
          style={{
            position: 'absolute',
            top: '15%',
            right: '-10%',
            width: 300,
            height: 300,
            background: 
              currentTask.status === 'completed' 
                ? 'radial-gradient(circle, rgba(34, 197, 94, 0.08), transparent)'
                : currentTask.status === 'in_progress'
                ? 'radial-gradient(circle, rgba(245, 158, 11, 0.08), transparent)'
                : 'radial-gradient(circle, rgba(125, 211, 252, 0.08), transparent)',
            borderRadius: '50%',
            filter: 'blur(80px)',
            zIndex: -1,
          }}
        />
      </div>

      {/* Progress indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 8,
        }}
      >
        {mockTasks.map((_, index) => (
          <div
            key={index}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: index === currentTaskIndex ? '#7dd3fc' : 'rgba(255, 255, 255, 0.3)',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};