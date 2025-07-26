import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { CheckCircle, Circle } from 'lucide-react';
import { realTaskData, realTodos } from '../mocks/mockData';

/**
 * TaskSwitchScene
 * ----------------
 * • Replaces the old fast "j j" demo with a calmer j / k navigation.
 * • Shows an entire **task detail page** (header, description, live todos).
 * • Uses 60 frames (2 s) per task → With the 120-frame window in SwarmAdvertisement we see two tasks.
 * • j / k key overlay fades in at the beginning of each switch.
 */

const TASKS = [
  {
    id: 56,
    title: realTaskData.task.title,
    description: realTaskData.task.description,
    status: 'pr_opened',
    todos: realTodos.slice(0, 5),
  },
  {
    id: 55,
    title:
      'Fix double database hit by removing redundant task ownership verification',
    description:
      'The task controller verifies task ownership twice. Remove redundant query to improve performance and update unit tests.',
    status: 'failed',
    todos: realTodos.slice(5, 10),
  },
];

type Status = 'pending' | 'in_progress' | 'completed' | 'failed' | 'pr_opened';

const statusColour: Record<Status, string> = {
  pending: '#64748b',
  in_progress: '#f59e0b',
  completed: '#22c55e',
  failed: '#dc2626',
  pr_opened: '#3b82f6',
};

export const TaskSwitchScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const FRAMES_PER_TASK = 60; // 2 s
  const taskIdx = Math.floor(frame / FRAMES_PER_TASK) % TASKS.length;
  const local = frame % FRAMES_PER_TASK;

  // Overlay animation for j/k key
  const keyOpacity = interpolate(local, [0, 6, 18], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Determine direction (j – down, k – up)
  const prevIdx = Math.floor((frame - 1) / FRAMES_PER_TASK) % TASKS.length;
  const movingDown = taskIdx > prevIdx || (prevIdx === TASKS.length - 1 && taskIdx === 0);
  const keyLabel = movingDown ? 'j' : 'k';

  // Todo progress (each completes over 20 frames)
  const FRAMES_PER_TODO = 20;
  const completedTodos = Math.min(
    Math.floor(local / FRAMES_PER_TODO),
    TASKS[taskIdx].todos.length,
  );

  // Card enter spring
  const cardScale = spring({ frame: local, fps, config: { damping: 120, stiffness: 180 } });

  const task = TASKS[taskIdx];

  return (
    <AbsoluteFill style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Key overlay */}
      {keyOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 70,
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: keyOpacity,
          }}
        >
          <div
            style={{
              background: '#1a1f2e',
              border: '2px solid #fbbf24',
              borderRadius: 10,
              padding: '10px 18px',
              color: '#fbbf24',
              fontFamily: 'SF Mono, Monaco, monospace',
              fontSize: 20,
              fontWeight: 700,
              boxShadow: '0 4px 20px rgba(251,191,36,.35)',
            }}
          >
            {keyLabel}
          </div>
        </div>
      )}

      {/* Card */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${cardScale})`,
          width: width * 0.82,
          height: height * 0.78,
          background: '#ffffff',
          borderRadius: 18,
          boxShadow: '0 30px 70px rgba(0,0,0,.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: 32, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'SF Mono, Monaco, monospace',
                background: '#f3f4f6',
                color: '#6b7280',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 14,
              }}
            >
              #{task.id}
            </span>
            <h2 style={{ fontSize: 30, margin: 0, lineHeight: 1.2 }}>{task.title}</h2>
            <span
              style={{
                marginLeft: 'auto',
                background: statusColour[task.status as Status],
                color: '#fff',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              {task.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Description */}
        <div style={{ padding: '24px 32px', flex: '0 0 auto' }}>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>{task.description}</p>
        </div>

        {/* Todos */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 32px 32px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Todos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {task.todos.map((t, i) => {
              const done = i < completedTodos;
              const Icon = done ? CheckCircle : Circle;
              return (
                <div
                  key={t.todo_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: done ? 'rgba(34,197,94,.1)' : '#f9fafb',
                  }}
                >
                  <Icon size={16} style={{ color: done ? '#22c55e' : '#64748b' }} />
                  <span
                    style={{
                      fontSize: 14,
                      textDecoration: done ? 'line-through' : 'none',
                      color: done ? '#6b7280' : '#111827',
                    }}
                  >
                    {t.content}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: 48,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'SF Mono, Monaco, monospace',
          fontSize: 14,
          color: '#22c55e',
        }}
      >
        j / k to navigate • {TASKS.length} tasks
      </div>
    </AbsoluteFill>
  );
};