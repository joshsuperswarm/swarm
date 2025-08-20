import React, { useRef, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useHotkeys } from 'react-hotkeys-hook';
import { ChatBubble } from "@/components/ChatBubble";
import { CollapsedTodoList } from "@/components/CollapsedTodoList";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { RunModeButton } from "@/components/RunModeButton";
import { InlineRunProgress } from "@/components/InlineRunProgress";
import { statuses } from "@/data/data";
import { useTaskDetailsQuery, useTasksQuery, useArchiveTaskMutation, useTaskTodosQuery } from "@/services/queries";
import { useSendTaskMessage } from "@/hooks/useSendTaskMessage";
import { useRunMode } from "@/hooks/useRunMode";
import { useStickToBottom } from "@/hooks/useStickToBottom";
import { useRunPhase } from "@/hooks/useRunPhase";
import { Bot, ArrowLeft, Sparkles, Zap } from 'lucide-react';
import type { MessageWithRun } from "@/types/generated/MessageWithRun";
import type { TaskWithRun } from "@/types/generated/TaskWithRun";
import type { RunMode, ClaudeModel } from "@/services/api";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { isTitlePending } from "@/lib/titleState";
import { useTaskSelectionStore } from "@/store/taskSelectionStore";

export function TaskChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const parsed = Number(id);
  const taskId = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const { setSelectedTaskId } = useTaskSelectionStore();

  // Key filter to ignore hotkeys when user is typing
  const keyFilter = (keyboardEvent: KeyboardEvent) => {
    const target = keyboardEvent.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    const isContentEditable = target.contentEditable === "true";
    return !(tagName === "input" || tagName === "textarea" || isContentEditable);
  };
  
  // Use unified task details query
  const { data: taskDetails, isLoading } = useTaskDetailsQuery(taskId || 0, taskId !== null);
  
  // Get all tasks for j/k navigation
  const { data: allTasks = [] } = useTasksQuery();
  const { mutateAsync: sendMessage, isPending: isSending } = useSendTaskMessage(taskId || 0);
  const archiveMutation = useArchiveTaskMutation();
  
  // Extract current run status for todo fetching
  const task = taskDetails?.task;
  const messages = taskDetails?.messages || [];
  const currentRun = messages.length > 0 ? messages[messages.length - 1]?.run : null;
  const currentRunStatus = currentRun?.run?.status;
  
  // Get todos for the current task
  const { data: todos = [], isLoading: isLoadingTodos } = useTaskTodosQuery(
    taskId || 0, 
    currentRunStatus || undefined,
    taskId !== null && taskId > 0
  );
  
  // Get run status and phase early for hooks
  const phase = useRunPhase(currentRunStatus);
  
  // Prepare task list for navigation (same filtering as TasksPage)
  const unarchived = allTasks.filter((t: TaskWithRun) => !t.is_archived && t.status !== 'archived');
  const tasks = [...unarchived].reverse(); // Newest first, same as TasksPage
  
  // Find current task index in the list
  const currentTaskIndex = taskId ? tasks.findIndex(t => t.task_id === taskId) : -1;
  
  // Navigate to adjacent task
  const navigateToTask = (direction: 'next' | 'prev') => {
    if (tasks.length === 0) return;
    
    let nextIndex;
    if (direction === 'next') {
      nextIndex = currentTaskIndex < tasks.length - 1 ? currentTaskIndex + 1 : tasks.length - 1;
    } else {
      nextIndex = currentTaskIndex > 0 ? currentTaskIndex - 1 : 0;
    }
    
    if (nextIndex !== currentTaskIndex && tasks[nextIndex]) {
      navigate(`/tasks/${tasks[nextIndex].task_id}`);
    }
  };
  
  // Archive task handler
  const handleArchive = () => {
    if (taskId) {
      archiveMutation.mutate(taskId, {
        onSuccess: () => {
          // Navigate back to tasks list after archiving
          navigate('/');
        }
      });
    }
  };
  
  // Use the mode from current run, fallback to default execute mode
  const initialMode = (currentRun?.run?.mode || "execute") as RunMode;
  const { mode, cycleRunMode } = useRunMode(initialMode);
  
  // Chat input state
  const [inputValue, setInputValue] = useState("");
  
  // Model selection state with localStorage persistence
  const [model, setModel] = useState<ClaudeModel>(() => {
    const saved = localStorage.getItem('taskChatModel');
    return (saved === 'sonnet' || saved === 'opus') ? saved : 'sonnet';
  });
  
  // Model cycling
  const models: ClaudeModel[] = ['sonnet', 'opus'];
  
  const cycleModel = () => {
    const currentIndex = models.indexOf(model);
    const nextIndex = (currentIndex + 1) % models.length;
    setModel(models[nextIndex]);
  };
  
  const getModelConfig = (model: ClaudeModel) => {
    switch (model) {
      case 'sonnet':
        return { icon: Zap, label: 'Sonnet', color: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700' };
      case 'opus':
        return { icon: Sparkles, label: 'Opus', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' };
    }
  };
  
  // Save model preference to localStorage
  useEffect(() => {
    localStorage.setItem('taskChatModel', model);
  }, [model]);

  // Store the selected task ID for restoration on TasksPage
  useEffect(() => {
    if (taskId != null) setSelectedTaskId(taskId);
  }, [taskId, setSelectedTaskId]);
  
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { onScroll, showJump, jumpToLatest } = useStickToBottom({
    containerRef,
    bottomRef,
    itemCount: messages.length,
    threshold: 16,
  });
  
  
  // Navigation hotkeys
  useHotkeys('esc', () => {
    if (taskId != null) setSelectedTaskId(taskId);
    navigate('/');
  }, {
    ignoreEventWhen: (e) => !keyFilter(e)
  });
  
  // j/k navigation between tasks
  useHotkeys('j', () => {
    navigateToTask('next');
  }, {
    ignoreEventWhen: (e) => !keyFilter(e)
  });
  
  useHotkeys('k', () => {
    navigateToTask('prev');
  }, {
    ignoreEventWhen: (e) => !keyFilter(e)
  });
  
  // Archive task hotkey
  useHotkeys('e', () => {
    handleArchive();
  }, {
    ignoreEventWhen: (e) => !keyFilter(e)
  });
  
  if (isLoading || !task) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-linear-text-muted">Loading task...</p>
        </div>
      </div>
    );
  }
  
  const finished = ["done", "failed", "pr_opened"].includes(
    currentRunStatus || "",
  );
  const status = statuses.find((s) => s.value === currentRunStatus);
  
  // Pick the first user message as description proxy if available
  const firstUser = messages.find(m => m.role === "user");
  const pendingTitle = isTitlePending({
    title: task.title,
    status: currentRunStatus || null,
    description: firstUser?.content || null,
  });
  
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    try {
      await sendMessage({
        content: inputValue.trim(),
        mode,
        model,
      });
      setInputValue("");
    } catch (error) {
      console.error("Failed to send message:", error);
      // The error will be handled by the hook's onError callback
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      cycleRunMode();
    }
  };
  
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-white sticky top-0 z-30 safe-pt px-3 py-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                if (taskId != null) setSelectedTaskId(taskId);
                navigate('/');
              }}
              aria-label="Back to tasks"
              title="Back to tasks (Esc)"
              className="h-9 w-9 flex items-center justify-center rounded-md bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded shrink-0">
              #{task.id}
            </span>
            <h1 className="text-lg md:text-xl font-semibold text-gray-900 truncate">
              <AnimatedTitle title={task.title || ""} pending={pendingTitle} />
            </h1>
          </div>
          
          {/* Task Status */}
          {status && (
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Status
              </span>
              {status.icon && <status.icon className="h-3 w-3 text-gray-500" />}
              {status.value === "pr_opened" && task.github_pr_url ? (
                <a
                  href={task.github_pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  {status.label}
                </a>
              ) : (
                <span className="text-sm text-gray-900">{status.label}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 pb-36 md:pb-40"
        onScroll={onScroll}
      >
        <div className="mx-auto w-full max-w-3xl space-y-4">
        
        
        {messages.length === 0 && !finished && !isSending ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Start a conversation with Claude Code</p>
            </div>
          </div>
        ) : (
          messages.map((message: MessageWithRun, idx: number) => {
            const prevRole = idx > 0 ? messages[idx - 1].role : null;
            const isGrouped = prevRole === message.role;
            const isLastUserMsg = message.role === "user" && idx === messages.length - 1;
            return (
              <div key={message.id} className={isGrouped ? "mt-1" : "mt-4"}>
                <div
                  className={`${
                    message.role === "user" ? "flex justify-end" : "flex justify-start"
                  }`}
                >
                  <ChatBubble
                    variant={message.role === "user" ? "user" : "assistant"}
                    fullWidth={message.role === "assistant"}
                    content={message.content}
                  >
                    {message.role === "assistant" ? (
                      <div>
                        <MarkdownRenderer content={message.content} />
                        {message.metadata?.pending && (
                          <span className="ml-2 inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
                        )}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap break-words">
                        {message.content}
                        {message.metadata?.pending && (
                          <span className="ml-2 inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
                        )}
                      </div>
                    )}
                    <div
                      className="mt-2 text-xs opacity-70"
                      title={new Date(message.created_at || new Date().toISOString()).toLocaleString()}
                    >
                      {formatTime(message.created_at || new Date().toISOString())}
                    </div>

                    {/* ─── NEW: per-message run meta ─── */}
                    {message.role === "assistant" && message.run && (
                      <div className="mt-3 space-y-3">
                        {message.run.todos?.length > 0 && (
                          <CollapsedTodoList todos={message.run.todos} />
                        )}
                      </div>
                    )}
                  </ChatBubble>
                </div>
                {isLastUserMsg && (
                  <div className="flex justify-start mt-2">
                    <InlineRunProgress
                      phase={phase}
                      todos={todos}
                      isLoadingTodos={isLoadingTodos}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
        
        {isSending && (
          <div className="flex justify-end">
            <ChatBubble variant="assistant">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-gray-300 text-sm">Claude is thinking...</span>
              </div>
            </ChatBubble>
          </div>
        )}
        
        <div ref={bottomRef} />
        </div>
      </div>

      {/* Jump to latest chip */}
      {showJump && (
        <div className="fixed bottom-24 md:bottom-28 inset-x-0 z-30">
          <div className="mx-auto w-full max-w-3xl flex justify-center">
            <button
              onClick={jumpToLatest}
              className="px-3 py-1.5 rounded-full text-xs border bg-white shadow hover:bg-gray-50"
            >
              Jump to latest ↓
            </button>
          </div>
        </div>
      )}

      {/* Floating composer */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 safe-pb px-3 pb-3">
        <div className="mx-auto w-full max-w-3xl pointer-events-auto">
          <div className="rounded-xl md:rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2">
              {/* Buttons row on mobile */}
              <div className="flex gap-2 sm:contents">
                {/* Mode button */}
                <div className="flex-1 sm:flex-none">
                  <RunModeButton
                    mode={mode}
                    onClick={cycleRunMode}
                    size="sm"
                    showLabel={true}
                    title="Shift+Tab to cycle modes"
                    className="w-full justify-center"
                  />
                </div>

                {/* Model button */}
                <div className="flex-1 sm:flex-none">
                  <button
                    onClick={cycleModel}
                    className={`w-full flex items-center justify-center gap-1 px-2 py-2 rounded-md text-xs font-medium border transition-colors touch-target ${getModelConfig(model).color}`}
                    title="Click to cycle models"
                  >
                    {React.createElement(getModelConfig(model).icon, { size: 14 })}
                    <span>{getModelConfig(model).label}</span>
                  </button>
                </div>
              </div>

              {/* Input - full width on mobile */}
              <div className="flex-1 w-full sm:w-auto">
                <div className="group relative flex items-center rounded-md border border-gray-300 bg-white focus-within:border-blue-500 transition-colors">
                  <input
                    type="text"
                    placeholder="Type your message…"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isSending}
                    className="flex-1 px-3 py-2 text-gray-900 placeholder:text-gray-500 bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:text-gray-400 min-w-0"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isSending}
                    className="m-1 w-8 h-8 rounded-md bg-gray-900 text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors flex items-center justify-center touch-target flex-shrink-0"
                    title="Send message"
                  >
                    <span className="text-xs">{isSending ? "..." : "→"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}