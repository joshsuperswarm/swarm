import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill
} from 'remotion';

// Mock tasks for vim navigation demo
const mockTasks = [
  { task_id: 1, title: "Set up authentication system", status: "completed" },
  { task_id: 2, title: "Implement user dashboard", status: "completed" },
  { task_id: 3, title: "Add real-time notifications", status: "in_progress" },
  { task_id: 4, title: "Optimize database queries", status: "pending" },
  { task_id: 5, title: "Design mobile interface", status: "pending" },
  { task_id: 6, title: "Write API documentation", status: "pending" },
  { task_id: 7, title: "Deploy to production", status: "pending" },
];

export const VimTableNavScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Navigation timing: each row highlight changes every 8 frames
  const currentRowIndex = Math.floor(frame / 8) % mockTasks.length;
  
  // Cursor glow animation
  const cursorGlow = interpolate(frame % 30, [0, 15, 30], [0.3, 1, 0.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Vim command indicator (j/k keys)
  const showCommand = frame % 16 < 8;
  const commandOpacity = interpolate(frame % 16, [0, 4, 8, 12, 16], [0, 1, 1, 0, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>
      {/* Terminal-style container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: width * 0.8,
          height: height * 0.7,
          backgroundColor: '#1e293b',
          borderRadius: 12,
          border: '2px solid #334155',
          padding: 32,
          fontFamily: 'SF Mono, Monaco, monospace',
          fontSize: 16,
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            marginBottom: 24,
            padding: '12px 0',
            borderBottom: '1px solid #475569',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: 14 }}>
            SWARM TASKS
          </div>
          <div
            style={{
              opacity: commandOpacity,
              color: '#fbbf24',
              fontSize: 14,
              fontWeight: 'bold',
            }}
          >
            {showCommand ? 'j' : 'k'}
          </div>
        </div>

        {/* Task list with vim navigation */}
        <div style={{ position: 'relative' }}>
          {mockTasks.map((task, index) => {
            const isFocused = index === currentRowIndex;
            const translateY = interpolate(
              frame,
              [index * 8, (index + 1) * 8],
              [0, -2],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );

            return (
              <div
                key={task.task_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 16px',
                  marginBottom: 4,
                  borderRadius: 6,
                  backgroundColor: isFocused ? '#1e40af' : 'transparent',
                  border: isFocused ? '1px solid #3b82f6' : '1px solid transparent',
                  transform: `translateY(${translateY}px)`,
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                {/* Vim cursor bar */}
                {isFocused && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 4,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3,
                      height: 20,
                      backgroundColor: '#f59e0b',
                      borderRadius: 2,
                      opacity: cursorGlow,
                      boxShadow: `0 0 12px rgba(245, 158, 11, ${cursorGlow})`,
                    }}
                  />
                )}

                {/* Task ID */}
                <div
                  style={{
                    color: isFocused ? '#f1f5f9' : '#64748b',
                    fontWeight: isFocused ? 'bold' : 'normal',
                    marginRight: 16,
                    minWidth: 24,
                  }}
                >
                  {task.task_id}
                </div>

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
                    marginRight: 12,
                    boxShadow: isFocused
                      ? `0 0 8px ${
                          task.status === 'completed'
                            ? '#22c55e'
                            : task.status === 'in_progress'
                            ? '#f59e0b'
                            : '#64748b'
                        }`
                      : 'none',
                  }}
                />

                {/* Task title */}
                <div
                  style={{
                    color: isFocused ? '#f8fafc' : '#cbd5e1',
                    fontWeight: isFocused ? '600' : 'normal',
                    flex: 1,
                  }}
                >
                  {task.title}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom status bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 32,
            right: 32,
            padding: '8px 12px',
            backgroundColor: '#0f172a',
            borderRadius: 6,
            fontSize: 12,
            color: '#64748b',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>NORMAL</span>
          <span>{mockTasks.length} tasks</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};