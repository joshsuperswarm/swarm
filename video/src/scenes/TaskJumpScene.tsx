import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill
} from 'remotion';

// Task details for the jump demonstration
const taskDetails = {
  1: {
    id: 1,
    title: "JWT Authentication System",
    description: "Implement secure JWT-based authentication with refresh tokens, user session management, and proper token validation middleware.",
    status: "completed",
    pr_link: "https://github.com/company/swarm/pull/123"
  },
  3: {
    id: 3,
    title: "Mobile-First UI Architecture", 
    description: "Design responsive system with touch-friendly components, gesture handling, and progressive enhancement for mobile devices.",
    status: "in_progress",
    pr_link: null
  }
};

export const TaskJumpScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Animation phases (60 frames total):
  // 0-20: Show task 1
  // 20-40: Type ":3" command
  // 40-45: Execute (flash)
  // 45-60: Show task 3

  const showingTask1 = frame < 40;
  const typingCommand = frame >= 20 && frame < 40;
  const executing = frame >= 40 && frame < 45;
  const showingTask3 = frame >= 45;

  // Command typing animation
  const command = ":3";
  const typingProgress = interpolate(frame, [20, 35], [0, command.length], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const currentCommand = command.substring(0, Math.floor(typingProgress));
  
  // Cursor blink
  const cursorBlink = interpolate(frame % 20, [0, 10, 20], [1, 0, 1]);
  const showCursor = typingCommand && cursorBlink > 0.5;

  // Task transitions
  const task1Opacity = interpolate(frame, [0, 20, 40], [1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const task3Opacity = interpolate(frame, [45, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Execute flash
  const executeFlash = interpolate(frame, [40, 42, 45], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Command bar opacity
  const commandBarOpacity = interpolate(frame, [20, 22, 38, 40], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const currentTask = showingTask3 ? taskDetails[3] : taskDetails[1];

  return (
    <AbsoluteFill>
      {/* Command bar overlay */}
      {typingCommand && (
        <div
          style={{
            position: 'absolute',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: commandBarOpacity,
            zIndex: 10,
          }}
        >
          <div
            style={{
              backgroundColor: '#1f2937',
              border: '2px solid #7dd3fc',
              borderRadius: 8,
              padding: '12px 20px',
              fontFamily: 'system-ui, sans-serif',
              fontSize: 18,
              color: '#7dd3fc',
              fontWeight: 600,
              boxShadow: '0 4px 16px rgba(125, 211, 252, 0.4)',
              minWidth: 60,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span>{currentCommand}</span>
            {showCursor && (
              <span
                style={{
                  width: 2,
                  height: 18,
                  backgroundColor: '#7dd3fc',
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
            backgroundColor: `rgba(125, 211, 252, ${executeFlash * 0.2})`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Main task container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: width * 0.8,
          height: height * 0.7,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        {/* Task 1 content */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#1f2937',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 12,
            padding: 40,
            opacity: task1Opacity,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <TaskContent task={taskDetails[1]} />
        </div>

        {/* Task 3 content */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#1f2937',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 12,
            padding: 40,
            opacity: task3Opacity,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <TaskContent task={taskDetails[3]} />
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
        :3 to jump to task 3
      </div>
    </AbsoluteFill>
  );
};

// Reusable task content component
const TaskContent: React.FC<{ task: typeof taskDetails[1] }> = ({ task }) => (
  <>
    {/* Header with ID and status */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: '#7dd3fc',
        }}
      >
        #{task.id}
      </div>
      <div
        style={{
          padding: '4px 12px',
          backgroundColor: task.status === 'completed' ? '#22c55e' : '#f59e0b',
          color: '#ffffff',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
        }}
      >
        {task.status}
      </div>
    </div>

    {/* Task title */}
    <h1
      style={{
        margin: 0,
        fontSize: 28,
        fontWeight: 600,
        color: 'rgba(255, 255, 255, 0.9)',
        marginBottom: 16,
        lineHeight: 1.3,
      }}
    >
      {task.title}
    </h1>

    {/* Task description */}
    <p
      style={{
        margin: 0,
        fontSize: 16,
        lineHeight: 1.6,
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: 24,
      }}
    >
      {task.description}
    </p>

    {/* PR link if available */}
    {task.pr_link && (
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(125, 211, 252, 0.1)',
          border: '1px solid rgba(125, 211, 252, 0.2)',
          borderRadius: 8,
          fontSize: 14,
          color: '#7dd3fc',
        }}
      >
        PR: {task.pr_link}
      </div>
    )}

    {/* Subtle background accent */}
    <div
      style={{
        position: 'absolute',
        top: '20%',
        right: '-5%',
        width: 200,
        height: 200,
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