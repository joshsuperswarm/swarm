import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill
} from 'remotion';

// Enhanced task details for dramatic transitions
const taskDetails = {
  1: {
    id: 1,
    title: "Implement JWT Authentication System",
    description: "Set up secure JWT-based authentication with refresh tokens, user session management, and proper token validation middleware. Includes password hashing, session storage, and logout functionality.",
    status: "completed",
    priority: "high",
    tags: ["Security", "Backend", "API"]
  },
  3: {
    id: 3,
    title: "Design Mobile-First UI Architecture", 
    description: "Architect responsive design system with touch-friendly components, gesture handling, and progressive enhancement. Create reusable component library with consistent spacing, typography, and interaction patterns.",
    status: "in_progress",
    priority: "high", 
    tags: ["Frontend", "Design", "Mobile"]
  }
};

export const TaskDetailSwitchScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Animation phases:
  // 0-15: Show task 1
  // 15-25: Type command ":3" character by character
  // 25-30: Execute command (flash/transition)
  // 30-45: Show task 3

  const showingTask1 = frame < 25;
  const typingCommand = frame >= 15 && frame < 25;
  const executing = frame >= 25 && frame < 30;
  const showingTask3 = frame >= 30;

  // Command typing animation - character by character
  const command = ":3";
  const typingProgress = interpolate(frame, [15, 23], [0, command.length], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const currentCommand = command.substring(0, Math.floor(typingProgress));
  
  // Cursor blink in command bar
  const cursorBlink = interpolate(frame % 20, [0, 10, 20], [1, 0, 1]);
  const showCursor = typingCommand && cursorBlink > 0.5;

  // Task transition animations
  const task1Opacity = interpolate(frame, [0, 15, 25], [1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const task1Scale = interpolate(frame, [20, 25], [1, 0.95], {
    extrapolateLeft: 'clamp', 
    extrapolateRight: 'clamp',
  });

  const task3Opacity = interpolate(frame, [30, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const task3Scale = interpolate(frame, [30, 35], [0.95, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Execute flash effect
  const executeFlash = interpolate(frame, [25, 27, 30], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Command bar animation
  const commandBarOpacity = interpolate(frame, [15, 17, 28, 30], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const currentTask = showingTask3 ? taskDetails[3] : taskDetails[1];

  return (
    <AbsoluteFill style={{ backgroundColor: '#0e0e10' }}>
      {/* Command bar overlay */}
      {(typingCommand || executing) && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: commandBarOpacity,
            zIndex: 10,
          }}
        >
          <div
            style={{
              backgroundColor: '#1a1f2e',
              border: '2px solid #fbbf24',
              borderRadius: 8,
              padding: '12px 20px',
              fontFamily: 'SF Mono, Monaco, monospace',
              fontSize: 20,
              color: '#fbbf24',
              fontWeight: 'bold',
              boxShadow: '0 8px 32px rgba(251, 191, 36, 0.4)',
              minWidth: 80,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span>{currentCommand}</span>
            {showCursor && (
              <span
                style={{
                  width: 3,
                  height: 20,
                  backgroundColor: '#fbbf24',
                  display: 'inline-block',
                  marginLeft: 2,
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Execute flash overlay */}
      {executeFlash > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: `rgba(59, 130, 246, ${executeFlash * 0.3})`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Main task detail container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: width * 0.8,
          height: height * 0.7,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Task 1 content */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#1e293b',
            border: '2px solid #334155',
            borderRadius: 16,
            padding: 40,
            opacity: task1Opacity,
            transform: `scale(${task1Scale})`,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <TaskDetailContent task={taskDetails[1]} />
        </div>

        {/* Task 3 content */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#1e293b',
            border: '2px solid #334155',
            borderRadius: 16,
            padding: 40,
            opacity: task3Opacity,
            transform: `scale(${task3Scale})`,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <TaskDetailContent task={taskDetails[3]} />
        </div>
      </div>

      {/* Speed indicator */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 60,
          fontFamily: 'SF Mono, Monaco, monospace',
          fontSize: 14,
          color: '#22c55e',
          fontWeight: 'bold',
          opacity: 0.8,
        }}
      >
        JUMP TO TASK
      </div>
    </AbsoluteFill>
  );
};

// Reusable task detail component
const TaskDetailContent: React.FC<{ task: typeof taskDetails[1] }> = ({ task }) => (
  <>
    {/* Header with status */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 32,
        paddingBottom: 20,
        borderBottom: '1px solid #475569',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            fontFamily: 'SF Mono, Monaco, monospace',
            fontSize: 24,
            fontWeight: 'bold',
            color: '#64748b',
          }}
        >
          #{task.id}
        </div>
        <div
          style={{
            padding: '6px 12px',
            backgroundColor: task.status === 'completed' ? '#22c55e' : '#f59e0b',
            color: '#ffffff',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}
        >
          {task.status}
        </div>
        <div
          style={{
            padding: '6px 12px',
            backgroundColor: task.priority === 'high' ? '#dc2626' : '#d97706',
            color: '#ffffff',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}
        >
          {task.priority}
        </div>
      </div>
    </div>

    {/* Task title */}
    <h1
      style={{
        margin: 0,
        fontSize: 32,
        fontWeight: 'bold',
        color: '#f8fafc',
        marginBottom: 24,
        lineHeight: 1.2,
      }}
    >
      {task.title}
    </h1>

    {/* Task description */}
    <p
      style={{
        margin: 0,
        fontSize: 18,
        lineHeight: 1.6,
        color: '#cbd5e1',
        marginBottom: 32,
      }}
    >
      {task.description}
    </p>

    {/* Tags */}
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {task.tags.map((tag, index) => (
        <div
          key={tag}
          style={{
            padding: '8px 16px',
            backgroundColor: '#334155',
            color: '#e2e8f0',
            borderRadius: 20,
            fontSize: 14,
            fontWeight: '500',
            border: '1px solid #475569',
          }}
        >
          {tag}
        </div>
      ))}
    </div>

    {/* Subtle background glow */}
    <div
      style={{
        position: 'absolute',
        top: '20%',
        right: '-10%',
        width: 300,
        height: 300,
        background: task.status === 'completed' 
          ? 'radial-gradient(circle, rgba(34, 197, 94, 0.1), transparent)'
          : 'radial-gradient(circle, rgba(245, 158, 11, 0.1), transparent)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        zIndex: -1,
      }}
    />
  </>
);