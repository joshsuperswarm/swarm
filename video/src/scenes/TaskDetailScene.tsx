import React from 'react';
import { 
  useCurrentFrame, 
  useVideoConfig, 
  interpolate,
  AbsoluteFill
} from 'remotion';
import { mockTodos, mockLogs, taskDetail } from '../../mockData';

export const TaskDetailScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Header animation - adjusted for 6s scene
  const headerOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Description animation - adjusted for 6s scene
  const descriptionOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Todos animation - adjusted for 6s scene
  const todosOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Todo item animations - more time for 6s scene
  const getTodoOpacity = (index: number) => {
    const startFrame = 60 + (index * 8);
    return interpolate(frame, [startFrame, startFrame + 12], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  };

  // Logs animation - more time for 6s scene
  const logsOpacity = interpolate(frame, [90, 110], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Log line animations - more time for 6s scene
  const getLogOpacity = (index: number) => {
    const startFrame = 110 + (index * 3);
    return interpolate(frame, [startFrame, startFrame + 5], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  };

  // Status dot styles - matching real TodoList component
  const getStatusDotStyle = (status: string) => {
    switch (status) {
      case 'completed': return { border: '1px solid #6B7280', backgroundColor: '#6B7280' };
      case 'in_progress': return { border: '1px solid hsl(222, 90%, 55%)', backgroundColor: 'transparent' };
      case 'pending': return { border: '1px solid #D1D5DB', backgroundColor: 'transparent' };
      default: return { border: '1px solid #D1D5DB', backgroundColor: 'transparent' };
    }
  };

  // Priority colors
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#FAFAFA', padding: 60 }}>
      {/* Header */}
      <div
        style={{
          opacity: headerOpacity,
          marginBottom: 30,
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
          <span
            style={{
              fontSize: 14,
              fontFamily: 'monospace',
              color: '#6B7280',
              backgroundColor: '#F8F9FA',
              padding: '4px 8px',
              borderRadius: 4,
            }}
          >
            #{taskDetail.task.id}
          </span>
          <h2
            style={{
              fontSize: 36,
              fontWeight: 'bold',
              color: 'hsl(240, 5%, 10%)',
              margin: 0,
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}
          >
            {taskDetail.task.title}
          </h2>
        </div>
        
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 14,
              fontWeight: '500',
              color: 'white',
              backgroundColor: '#f59e0b',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Running
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 40, height: 'calc(100% - 150px)' }}>
        {/* Left Column - Description and Todos */}
        <div style={{ flex: 1 }}>
          {/* Description */}
          <div
            style={{
              opacity: descriptionOpacity,
              marginBottom: 30,
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: 'hsl(240, 5%, 10%)',
                margin: 0,
                marginBottom: 12,
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              }}
            >
              Description
            </h3>
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: 6,
                padding: 20,
                border: '1px solid #E5E7EB',
              }}
            >
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'hsl(240, 5%, 10%)',
                  margin: 0,
                  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                  whiteSpace: 'pre-line',
                }}
              >
                {taskDetail.task.description.split('\n').slice(0, 8).join('\n')}
              </p>
            </div>
          </div>

          {/* Todos */}
          <div
            style={{
              opacity: todosOpacity,
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: 'hsl(240, 5%, 10%)',
                margin: 0,
                marginBottom: 12,
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              }}
            >
              AI Agent Progress
            </h3>
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: 6,
                border: '1px solid #E5E7EB',
                overflow: 'hidden',
              }}
            >
              {mockTodos.map((todo, index) => (
                <div
                  key={todo.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 4px',
                    borderBottom: 'none',
                    opacity: getTodoOpacity(index),
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    borderRadius: 2,
                    marginBottom: 4,
                  }}
                >
                  {/* Status indicator */}
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      ...getStatusDotStyle(todo.status),
                      flexShrink: 0,
                    }}
                  />
                  
                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        color: todo.status === 'completed' ? '#6B7280' : 'hsl(240, 5%, 10%)',
                        marginBottom: 0,
                        textDecoration: todo.status === 'completed' ? 'line-through' : 'none',
                        opacity: todo.status === 'completed' ? 0.7 : 1,
                      }}
                    >
                      {todo.content}
                    </div>
                  </div>

                  {/* Status text */}
                  <span
                    style={{
                      fontSize: 12,
                      color: '#6B7280',
                      fontWeight: 'normal',
                    }}
                  >
                    {todo.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Live Logs */}
        <div style={{ width: 500 }}>
          <div
            style={{
              opacity: logsOpacity,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: 0,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                Live Logs
              </h3>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    animation: 'pulse 2s infinite',
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: '#6b7280',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  Live updating
                </span>
              </div>
            </div>
            
            <div
              style={{
                backgroundColor: '#1f2937',
                borderRadius: 12,
                padding: 20,
                height: 400,
                overflow: 'hidden',
                fontFamily: 'monospace',
                fontSize: 12,
                lineHeight: 1.4,
              }}
            >
              {mockLogs.map((log, index) => (
                <div
                  key={index}
                  style={{
                    color: '#e5e7eb',
                    marginBottom: 2,
                    opacity: getLogOpacity(index),
                  }}
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};