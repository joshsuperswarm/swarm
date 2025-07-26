import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  spring
} from 'remotion';

const tasks = [
  {
    id: 42,
    title: 'JWT Authentication System',
    status: 'running',
    priority: 'high'
  },
  {
    id: 43,
    title: 'Real-time Dashboard Components',
    status: 'pending',
    priority: 'medium'
  },
  {
    id: 44,
    title: 'Mobile-First UI Architecture',
    status: 'completed',
    priority: 'low'
  }
];

export const TaskSwitchScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // First "j" keystroke: frames 0-10
  const firstJ = interpolate(frame, [0, 2, 6], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // First slide: starts at frame 4
  const firstSlide = spring({
    fps,
    frame: frame - 4,
    config: { damping: 120, stiffness: 180 },
    from: 0,
    to: 100,
  });

  // Second "j" keystroke: frames 50-60
  const secondJ = interpolate(frame, [50, 52, 56], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Second slide: starts at frame 54
  const secondSlide = spring({
    fps,
    frame: frame - 54,
    config: { damping: 120, stiffness: 180 },
    from: 0,
    to: 100,
  });

  // Determine which tasks to show
  const getCurrentTask = () => {
    if (frame < 30) return 0;
    if (frame < 80) return 1;
    return 2;
  };

  const getNextTask = () => {
    if (frame < 30) return 1;
    if (frame < 80) return 2;
    return 0;
  };

  const currentTaskIndex = getCurrentTask();
  const nextTaskIndex = getNextTask();
  const currentTask = tasks[currentTaskIndex];
  const nextTask = tasks[nextTaskIndex];

  // Calculate slide transforms
  const getSlideTransform = (isNext: boolean = false) => {
    let slideAmount = 0;
    
    if (frame >= 4 && frame < 54) {
      slideAmount = firstSlide;
    } else if (frame >= 54) {
      slideAmount = firstSlide + secondSlide;
    }

    if (isNext) {
      return `translateY(${100 - slideAmount}%)`;
    }
    return `translateY(${-slideAmount}%)`;
  };

  const TaskCard = ({ task, isNext = false }: { task: typeof tasks[0], isNext?: boolean }) => (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) ${getSlideTransform(isNext)}`,
        width: '80%',
        maxWidth: 700,
        backgroundColor: '#111315',
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        padding: 32,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#7dd3fc',
          }}
        >
          #{task.id}
        </div>
        <div
          style={{
            padding: '6px 16px',
            backgroundColor: 
              task.status === 'completed' ? '#22c55e' : 
              task.status === 'running' ? '#f59e0b' : '#64748b',
            color: '#ffffff',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {task.status}
        </div>
        <div
          style={{
            padding: '4px 12px',
            backgroundColor: task.priority === 'high' ? '#dc2626' : '#d97706',
            color: '#ffffff',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {task.priority}
        </div>
      </div>

      <h1
        style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 600,
          color: 'rgba(255, 255, 255, 0.95)',
          lineHeight: 1.3,
        }}
      >
        {task.title}
      </h1>
    </div>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#0e0e10' }}>
      {/* Subtle background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(125, 211, 252, 0.1), transparent)',
          filter: 'blur(100px)',
        }}
      />

      {/* Task cards */}
      <TaskCard task={currentTask} />
      <TaskCard task={nextTask} isNext />

      {/* First "j" keystroke overlay */}
      {firstJ > 0 && (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: 128,
            fontWeight: 700,
            color: 'white',
            opacity: firstJ,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
          }}
        >
          j
        </AbsoluteFill>
      )}

      {/* Second "j" keystroke overlay */}
      {secondJ > 0 && (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: 128,
            fontWeight: 700,
            color: 'white',
            opacity: secondJ,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
          }}
        >
          j
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};