import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill
} from 'remotion';
import { realTodos } from '../mocks/mockData';

export const TodosFlythroughScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Use first 8 todos for better visual flow
  const todos = realTodos.slice(0, 8);
  
  // Each todo completes every 15 frames (0.5 seconds at 30fps)
  const todosPerSecond = 2;
  const framesPerTodo = fps / todosPerSecond;

  // Progress bar animation
  const overallProgress = interpolate(frame, [0, framesPerTodo * todos.length], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Get todo animation state
  const getTodoState = (index: number) => {
    const todoStartFrame = index * framesPerTodo;
    const todoCompleteFrame = todoStartFrame + framesPerTodo * 0.7; // Complete 70% through
    
    const isStarted = frame >= todoStartFrame;
    const isCompleted = frame >= todoCompleteFrame;
    const isAnimating = frame >= todoStartFrame && frame < todoCompleteFrame;
    
    const opacity = isStarted ? 1 : 0.3;
    const scale = isAnimating ? 
      interpolate(frame, [todoStartFrame, todoCompleteFrame], [1, 1.05], { extrapolateRight: 'clamp' }) : 
      isCompleted ? 1 : 1;
    
    return { isStarted, isCompleted, isAnimating, opacity, scale };
  };

  // Flash effect for completion
  const getCompletionFlash = (index: number) => {
    const flashFrame = index * framesPerTodo + framesPerTodo * 0.7;
    return interpolate(frame, [flashFrame, flashFrame + 5], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#0f172a' }}>
      {/* Main container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: width * 0.8,
          height: height * 0.8,
          backgroundColor: '#1e293b',
          borderRadius: 16,
          border: '2px solid #334155',
          padding: 40,
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 32,
            paddingBottom: 16,
            borderBottom: '1px solid #475569',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 'bold',
                color: '#f8fafc',
                margin: 0,
                marginBottom: 8,
              }}
            >
              AI Agent Execution
            </h2>
            <p
              style={{
                fontSize: 14,
                color: '#94a3b8',
                margin: 0,
              }}
            >
              Completing tasks at machine speed
            </p>
          </div>
          
          {/* Progress indicator */}
          <div
            style={{
              fontSize: 32,
              fontWeight: 'bold',
              color: '#22c55e',
              fontFamily: 'SF Mono, Monaco, monospace',
            }}
          >
            {Math.round(overallProgress * 100)}%
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: '100%',
            height: 8,
            backgroundColor: '#334155',
            borderRadius: 4,
            marginBottom: 32,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${overallProgress * 100}%`,
              height: '100%',
              backgroundColor: '#22c55e',
              borderRadius: 4,
              boxShadow: '0 0 20px rgba(34, 197, 94, 0.5)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Todo list */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {todos.map((todo, index) => {
            const state = getTodoState(index);
            const flash = getCompletionFlash(index);
            
            return (
              <div
                key={todo.todo_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  marginBottom: 8,
                  borderRadius: 8,
                  backgroundColor: state.isCompleted ? 'rgba(34, 197, 94, 0.1)' : 'rgba(51, 65, 85, 0.3)',
                  border: state.isAnimating ? '1px solid #22c55e' : '1px solid transparent',
                  opacity: state.opacity,
                  transform: `scale(${state.scale})`,
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Completion flash overlay */}
                {flash > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: `rgba(34, 197, 94, ${flash * 0.3})`,
                      borderRadius: 8,
                    }}
                  />
                )}

                {/* Checkbox */}
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    border: state.isCompleted ? '2px solid #22c55e' : '2px solid #64748b',
                    backgroundColor: state.isCompleted ? '#22c55e' : 'transparent',
                    marginRight: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {state.isCompleted && (
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

                {/* Todo content */}
                <div
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: state.isCompleted ? '#94a3b8' : '#e2e8f0',
                    textDecoration: state.isCompleted ? 'line-through' : 'none',
                    opacity: state.isCompleted ? 0.8 : 1,
                  }}
                >
                  {todo.content}
                </div>

                {/* Lightning bolt for active todos */}
                {state.isAnimating && (
                  <div
                    style={{
                      color: '#fbbf24',
                      fontSize: 16,
                      marginLeft: 12,
                    }}
                  >
                    ACTIVE
                  </div>
                )}

                {/* Completion checkmark */}
                {state.isCompleted && flash > 0 && (
                  <div
                    style={{
                      color: '#22c55e',
                      fontSize: 18,
                      marginLeft: 12,
                      opacity: flash,
                    }}
                  >
                    COMPLETE
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Speed indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            fontSize: 12,
            color: '#64748b',
            fontFamily: 'SF Mono, Monaco, monospace',
          }}
        >
          {todosPerSecond} tasks/sec
        </div>
      </div>

      {/* Background particle effects */}
      {Array.from({ length: 5 }).map((_, i) => {
        const particleX = interpolate(frame, [0, 120], [width * (i * 0.2), width * (i * 0.2 + 0.2)], {
          extrapolateRight: 'extend',
        });
        const particleOpacity = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);
        
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: particleX,
              top: height * 0.3 + Math.sin(frame * 0.1 + i) * 50,
              width: 4,
              height: 4,
              backgroundColor: '#22c55e',
              borderRadius: '50%',
              opacity: particleOpacity * 0.6,
              boxShadow: '0 0 10px rgba(34, 197, 94, 0.8)',
            }}
          />
        );
      })}

      {/* Speed indicator overlay */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 40,
          fontSize: 14,
          color: '#22c55e',
          fontFamily: 'SF Mono, Monaco, monospace',
          fontWeight: 'bold',
        }}
      >
        RAPID EXECUTION MODE
      </div>
    </AbsoluteFill>
  );
};