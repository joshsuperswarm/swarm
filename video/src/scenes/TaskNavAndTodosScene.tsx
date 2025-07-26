import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
} from 'remotion';
import { realTodos } from '../mocks/mockData';
import { CheckCircle, Circle } from 'lucide-react';

/**
 * Redesigned j/k navigation scene
 * – Cycles through **full task detail pages** (ID, title, description, todos)
 * – Slower cadence: 3 s per task (90 frames at 30 fps)
 * – Shows a brief key-press overlay at the beginning of each cycle
 */

// 🍒 Sample tasks — replace with real data as needed
const tasks = [
  {
    id: 56,
    title:
      'Implement chat architecture refactor: messages table, API endpoints, and frontend integration',
    description:
      'Refactor chat system to use a proper messages table. Includes DB migrations, CRUD endpoints and updating frontend components. Maintain backward compatibility during rollout.',
    status: 'pr_opened',
    todos: realTodos.slice(0, 4),
  },
  {
    id: 55,
    title: 'Fix double database hit by removing redundant task ownership verification',
    description:
      'The task controller verifies task ownership twice. Remove redundant query to cut response time in half and update unit tests accordingly.',
    status: 'failed',
    todos: realTodos.slice(4, 8),
  },
  {
    id: 54,
    title: 'Migrate tasks.description to first user message in messages table',
    description:
      'Move legacy task descriptions into the new messages table to standardise conversation history. Provide one-off migration and cleanup script.',
    status: 'completed',
    todos: realTodos.slice(8, 10),
  },
];

type Status = 'pending' | 'in_progress' | 'completed' | 'failed' | 'pr_opened';

const statusColor: Record<Status, string> = {
  pending: '#64748b',
  in_progress: '#f59e0b',
  completed: '#22c55e',
  failed: '#dc2626',
  pr_opened: '#3b82f6',
};

export const TaskNavAndTodosScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  /* ── TIMING CONSTANTS ─────────────────────────────────────────────── */
  const FRAMES_PER_TASK = 90; // 3 seconds @30 fps
  const FRAMES_PER_TODO = 30; // each todo completes in 1 second

  /* ── DERIVED STATE ───────────────────────────────────────────────── */
  const currentTaskIdx = Math.floor(frame / FRAMES_PER_TASK) % tasks.length;
  const taskLocalFrame = frame % FRAMES_PER_TASK;
  const completedTodoCount = Math.min(
    Math.floor(taskLocalFrame / FRAMES_PER_TODO),
    tasks[currentTaskIdx].todos.length,
  );

  /* Key overlay: show j/k for first 15 frames of each cycle */
  const keyOpacity = interpolate(taskLocalFrame, [0, 5, 15], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const keyScale = interpolate(taskLocalFrame, [0, 5, 15], [0.8, 1, 0.8], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ── RENDER ──────────────────────────────────────────────────────── */
  const task = tasks[currentTaskIdx];

  return (
    <AbsoluteFill style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Key press overlay */}
      {keyOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: '50%',
            transform: `translateX(-50%) scale(${keyScale})`,
            opacity: keyOpacity,
          }}
        >
          <div
            style={{
              backgroundColor: '#1a1f2e',
              border: '2px solid #fbbf24',
              borderRadius: 10,
              padding: '12px 20px',
              boxShadow: '0 6px 24px rgba(251,191,36,.35)',
              color: '#fbbf24',
              fontFamily: 'SF Mono, Monaco, monospace',
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            j
          </div>
        </div>
      )}

      {/* Task detail card */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: width * 0.8,
          height: height * 0.75,
          backgroundColor: '#ffffff',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,.4)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: 32, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'SF Mono, Monaco, monospace',
                fontSize: 18,
                color: '#6b7280',
                background: '#f3f4f6',
                padding: '4px 8px',
                borderRadius: 6,
              }}
            >
              #{task.id}
            </span>
            <h2 style={{ fontSize: 28, margin: 0, lineHeight: 1.2 }}>{task.title}</h2>
            <span
              style={{
                marginLeft: 'auto',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                color: '#fff',
                backgroundColor: statusColor[task.status as Status] || '#64748b',
              }}
            >
              {task.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Description */}
        <div style={{ padding: '24px 32px', flex: '0 0 auto' }}>
          <p style={{ fontSize: 16, lineHeight: 1.5, margin: 0 }}>{task.description}</p>
        </div>

        {/* Todos list */}
        <div style={{ flex: 1, overflowY: 'hidden', padding: '0 32px 32px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Todos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {task.todos.map((todo, idx) => {
              const isCompleted = idx < completedTodoCount;
              const Icon = isCompleted ? CheckCircle : Circle;
              return (
                <div
                  key={todo.todo_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 8,
                    backgroundColor: isCompleted ? 'rgba(34,197,94,.1)' : '#f9fafb',
                    transition: 'background-color .2s ease',
                  }}
                >
                  <Icon
                    size={16}
                    style={{ color: isCompleted ? '#22c55e' : '#64748b', flexShrink: 0 }}
                  />
                  <span
                    style={{
                      textDecoration: isCompleted ? 'line-through' : 'none',
                      color: isCompleted ? '#6b7280' : '#111827',
                      fontSize: 14,
                    }}
                  >
                    {todo.content}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Status footer */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'SF Mono, Monaco, monospace',
          fontSize: 14,
          color: '#22c55e',
        }}
      >
        j / k to navigate tasks • {tasks.length} total
      </div>
    </AbsoluteFill>
  );
};