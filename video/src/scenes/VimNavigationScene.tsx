import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill
} from 'remotion';

// Enhanced mock tasks with full content
const mockTasks = [
  {
    id: 1,
    title: "Implement JWT Authentication System",
    description: "Set up secure JWT-based authentication with refresh tokens, user session management, and proper token validation middleware.",
    status: "completed",
    priority: "high"
  },
  {
    id: 2,
    title: "Build Real-time Dashboard Components",
    description: "Create interactive dashboard with live metrics, WebSocket connections, and responsive data visualization charts.",
    status: "completed", 
    priority: "high"
  },
  {
    id: 3,
    title: "Design Mobile-First UI Architecture",
    description: "Architect responsive design system with touch-friendly components, gesture handling, and progressive enhancement.",
    status: "in_progress",
    priority: "high"
  },
  {
    id: 4,
    title: "Optimize Database Query Performance",
    description: "Analyze and optimize slow queries, implement proper indexing strategies, and add query caching layers.",
    status: "pending",
    priority: "medium"
  },
  {
    id: 5,
    title: "Deploy Production Infrastructure",
    description: "Set up CI/CD pipelines, container orchestration, monitoring systems, and automated deployment workflows.",
    status: "pending",
    priority: "high"
  }
];

export const VimNavigationScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Navigation timing: each task focused for 12 frames (0.4 seconds at 30fps)
  const currentIndex = Math.floor(frame / 12) % mockTasks.length;
  
  // Keypress animation - show j or k based on direction
  const keyPressFrame = frame % 12;
  const showKeyPress = keyPressFrame < 8;
  const keyOpacity = interpolate(keyPressFrame, [0, 3, 8], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Determine if moving up or down
  const prevIndex = Math.floor((frame - 1) / 12) % mockTasks.length;
  const isMovingDown = currentIndex > prevIndex || (prevIndex === mockTasks.length - 1 && currentIndex === 0);
  const currentKey = isMovingDown ? 'j' : 'k';

  // Terminal cursor blink
  const cursorBlink = interpolate(frame % 30, [0, 15, 30], [1, 0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0e0e10' }}>
      {/* Terminal keypress overlay */}
      {showKeyPress && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 60,
            opacity: keyOpacity,
            transform: `scale(${keyOpacity})`,
          }}
        >
          <div
            style={{
              backgroundColor: '#1a1f2e',
              border: '2px solid #fbbf24',
              borderRadius: 12,
              padding: '16px 24px',
              boxShadow: '0 8px 32px rgba(251, 191, 36, 0.4)',
            }}
          >
            <div
              style={{
                fontFamily: 'SF Mono, Monaco, monospace',
                fontSize: 24,
                fontWeight: 'bold',
                color: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{currentKey}</span>
              <span
                style={{
                  opacity: cursorBlink,
                  width: 3,
                  height: 24,
                  backgroundColor: '#fbbf24',
                  display: 'inline-block',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main task list container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: width * 0.85,
          height: height * 0.75,
          backgroundColor: '#1e293b',
          borderRadius: 16,
          border: '2px solid #334155',
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 32px',
            borderBottom: '1px solid #475569',
            backgroundColor: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontFamily: 'SF Mono, Monaco, monospace',
              fontSize: 16,
              color: '#94a3b8',
              fontWeight: 'bold',
            }}
          >
            SWARM TASKS
          </div>
          <div
            style={{
              fontFamily: 'SF Mono, Monaco, monospace',
              fontSize: 14,
              color: '#64748b',
            }}
          >
            {mockTasks.length} tasks • VIM MODE
          </div>
        </div>

        {/* Task list */}
        <div style={{ padding: '16px 0' }}>
          {mockTasks.map((task, index) => {
            const isFocused = index === currentIndex;
            
            // Enhanced focus animations
            const scale = isFocused ? 1.05 : 1;
            const translateX = isFocused ? 8 : 0;
            const backgroundOpacity = isFocused ? 1 : 0;
            
            // Pulsing glow for focused item
            const glowIntensity = isFocused ? 
              interpolate(frame % 60, [0, 30, 60], [0.3, 1, 0.3]) : 0;

            return (
              <div
                key={task.id}
                style={{
                  margin: '0 16px 8px',
                  padding: '20px 24px',
                  borderRadius: 12,
                  backgroundColor: isFocused ? '#1e40af' : 'transparent',
                  border: isFocused ? '2px solid #3b82f6' : '2px solid transparent',
                  transform: `scale(${scale}) translateX(${translateX}px)`,
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  cursor: 'pointer',
                  boxShadow: isFocused ? 
                    `0 8px 32px rgba(59, 130, 246, ${glowIntensity * 0.4})` : 'none',
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
                      width: 4,
                      height: 40,
                      backgroundColor: '#f59e0b',
                      borderRadius: 2,
                      opacity: glowIntensity,
                      boxShadow: `0 0 16px rgba(245, 158, 11, ${glowIntensity})`,
                    }}
                  />
                )}

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  {/* Task ID */}
                  <div
                    style={{
                      fontFamily: 'SF Mono, Monaco, monospace',
                      fontSize: 18,
                      fontWeight: 'bold',
                      color: isFocused ? '#f8fafc' : '#64748b',
                      minWidth: 32,
                      paddingTop: 2,
                    }}
                  >
                    {task.id}
                  </div>

                  {/* Status indicator */}
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor:
                        task.status === 'completed'
                          ? '#22c55e'
                          : task.status === 'in_progress'
                          ? '#f59e0b'
                          : '#64748b',
                      marginTop: 6,
                      boxShadow: isFocused ? 
                        `0 0 12px ${
                          task.status === 'completed'
                            ? '#22c55e'
                            : task.status === 'in_progress'
                            ? '#f59e0b'
                            : '#64748b'
                        }` : 'none',
                    }}
                  />

                  {/* Task content */}
                  <div style={{ flex: 1 }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: isFocused ? 20 : 16,
                        fontWeight: isFocused ? 'bold' : '600',
                        color: isFocused ? '#f8fafc' : '#e2e8f0',
                        marginBottom: 8,
                        fontFamily: 'Inter, system-ui, sans-serif',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {task.title}
                    </h3>
                    
                    {isFocused && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          color: '#cbd5e1',
                          lineHeight: 1.5,
                          fontFamily: 'Inter, system-ui, sans-serif',
                          opacity: interpolate(keyPressFrame, [3, 8], [0, 1], {
                            extrapolateLeft: 'clamp',
                            extrapolateRight: 'clamp',
                          }),
                        }}
                      >
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Priority badge */}
                  <div
                    style={{
                      padding: '4px 8px',
                      backgroundColor: task.priority === 'high' ? '#dc2626' : '#d97706',
                      color: '#ffffff',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      opacity: isFocused ? 1 : 0.7,
                    }}
                  >
                    {task.priority}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom status bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 32px',
            backgroundColor: '#0f172a',
            borderTop: '1px solid #475569',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'SF Mono, Monaco, monospace',
              fontSize: 12,
              color: '#22c55e',
              fontWeight: 'bold',
            }}
          >
            -- NORMAL --
          </div>
          <div
            style={{
              fontFamily: 'SF Mono, Monaco, monospace',
              fontSize: 12,
              color: '#64748b',
            }}
          >
            j/k to navigate • : for commands
          </div>
        </div>
      </div>

      {/* Speed indicator */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          right: 60,
          fontFamily: 'SF Mono, Monaco, monospace',
          fontSize: 14,
          color: '#22c55e',
          fontWeight: 'bold',
          opacity: 0.8,
        }}
      >
        NAVIGATION MODE
      </div>
    </AbsoluteFill>
  );
};