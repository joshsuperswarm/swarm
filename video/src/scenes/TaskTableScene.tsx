import React from 'react';
import { 
  useCurrentFrame, 
  useVideoConfig, 
  interpolate,
  AbsoluteFill,
  spring
} from 'remotion';
import { mockTasks } from '../../mockData';

export const TaskTableScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Header animation - faster for 3s scene
  const headerOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const headerTranslateY = interpolate(frame, [0, 15], [-20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Table animation - very fast for 3s scene
  const getRowOpacity = (index: number) => {
    const startFrame = 15 + (index * 5);
    return interpolate(frame, [startFrame, startFrame + 8], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  };

  const getRowTranslateX = (index: number) => {
    const startFrame = 15 + (index * 5);
    return interpolate(frame, [startFrame, startFrame + 8], [50, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  };

  // Status badge colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return '#f59e0b';
      case 'done': return '#10b981';
      case 'pr_opened': return '#3b82f6';
      case 'spinning': return '#8b5cf6';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Mode colors
  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'execute': return '#10b981';
      case 'plan': return '#3b82f6';
      case 'review': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  // Highlight animation for featured row - adjusted for 3s scene
  const highlightOpacity = interpolate(frame, [60, 65, 80, 85], [0, 0.1, 0.1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#FAFAFA', padding: 60 }}>
      {/* Header */}
      <div
        style={{
          opacity: headerOpacity,
          transform: `translateY(${headerTranslateY}px)`,
          marginBottom: 40,
        }}
      >
        <h2
          style={{
            fontSize: 48,
            fontWeight: 'bold',
            color: 'hsl(240, 5%, 10%)',
            margin: 0,
            marginBottom: 16,
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}
        >
          Task Dashboard
        </h2>
        <p
          style={{
            fontSize: 20,
            color: '#6B7280',
            margin: 0,
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}
        >
          Manage and track all your development tasks in one place
        </p>
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 6,
          border: '1px solid #E5E7EB',
          overflow: 'hidden',
        }}
      >
        {/* Table Header */}
        <div
          style={{
            display: 'flex',
            backgroundColor: '#F8F9FA',
            borderBottom: '1px solid #E5E7EB',
            padding: '16px 24px',
            fontSize: 14,
            fontWeight: '600',
            color: '#6B7280',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}
        >
          <div style={{ width: 80 }}>Task</div>
          <div style={{ width: 80 }}>Mode</div>
          <div style={{ flex: 1 }}>Title</div>
          <div style={{ width: 120 }}>Status</div>
          <div style={{ width: 120 }}>Created</div>
        </div>

        {/* Table Rows */}
        {mockTasks.map((task, index) => (
          <div
            key={task.task_id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '20px 24px',
              borderBottom: index < mockTasks.length - 1 ? '1px solid #F3F4F6' : 'none',
              opacity: getRowOpacity(index),
              transform: `translateX(${getRowTranslateX(index)}px)`,
              backgroundColor: index === 0 ? `rgba(59, 130, 246, ${highlightOpacity})` : 'transparent',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}
          >
            {/* Task ID */}
            <div
              style={{
                width: 80,
                fontSize: 12,
                fontFamily: 'monospace',
                color: '#6B7280',
              }}
            >
              #{task.task_id}
            </div>

            {/* Mode */}
            <div style={{ width: 80 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  color: getModeColor(task.mode),
                  fontWeight: '500',
                  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}
              >
                {task.mode.charAt(0).toUpperCase() + task.mode.slice(1)}
              </span>
            </div>

            {/* Title */}
            <div
              style={{
                flex: 1,
                fontSize: 14,
                color: 'hsl(240, 5%, 10%)',
                fontWeight: '500',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {task.title}
            </div>

            {/* Status */}
            <div style={{ width: 120 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: '500',
                  color: 'white',
                  backgroundColor: getStatusColor(task.status),
                }}
              >
                {task.status.replace('_', ' ').charAt(0).toUpperCase() + task.status.replace('_', ' ').slice(1)}
              </span>
            </div>

            {/* Created Date */}
            <div
              style={{
                width: 120,
                fontSize: 12,
                color: '#6B7280',
              }}
            >
              {new Date(task.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom text */}
      <div
        style={{
          marginTop: 40,
          textAlign: 'center',
          opacity: interpolate(frame, [70, 85], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        <p
          style={{
            fontSize: 18,
            color: '#6B7280',
            margin: 0,
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}
        >
          Keyboard navigation • Real-time status updates • GitHub integration
        </p>
      </div>
    </AbsoluteFill>
  );
};