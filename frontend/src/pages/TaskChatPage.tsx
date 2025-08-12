import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ChatBubble } from "@/components/ChatBubble";
import { CollapsedTodoList } from "@/components/CollapsedTodoList";
import { CollapsedLogViewer } from "@/components/CollapsedLogViewer";
import { statuses } from "@/data/data";
import { useTaskDetailsQuery } from "@/services/queries";
import { useSendTaskMessage } from "@/hooks/useSendTaskMessage";
import { useRunMode } from "@/hooks/useRunMode";
import { Bot } from 'lucide-react';
import type { TaskLog } from "@/types/generated/TaskLog";
import type { MessageWithRun } from "@/types/generated/MessageWithRun";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { isTitlePending } from "@/lib/titleState";

export function TaskChatPage() {
  const { id } = useParams<{ id: string }>();
  const taskId = parseInt(id || "0", 10);
  
  // Use unified task details query
  const { data: taskDetails, isLoading } = useTaskDetailsQuery(taskId);
  const { mutateAsync: sendMessage, isPending: isSending } = useSendTaskMessage(taskId);
  
  // Extract data from unified response
  const task = taskDetails?.task;
  const messages = taskDetails?.messages || [];
  const currentRun = messages.length > 0 ? messages[messages.length - 1]?.run : null;
  const { mode, cycleRunMode, getModeConfig } = useRunMode("execute");
  
  // Chat input state
  const [inputValue, setInputValue] = useState("");
  
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [showJump, setShowJump] = useState(false);
  
  useEffect(() => {
    // scroll to bottom on new messages
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);
  
  if (isLoading || !task) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-linear-text-muted">Loading task...</p>
        </div>
      </div>
    );
  }
  
  const currentRunStatus = currentRun?.run?.status;
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
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
              #{task.id}
            </span>
            <h1 className="text-lg md:text-xl font-semibold text-gray-900">
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
        className="overflow-y-auto px-3 py-3 pb-36 md:pb-40"
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 16;
          setShowJump(!atBottom);
        }}
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
            return (
              <div
                key={message.id}
                className={`${
                  message.role === "user" ? "flex justify-end" : "flex justify-start"
                } ${isGrouped ? "mt-1" : "mt-4"}`}
              >
              <ChatBubble
                variant={message.role === "user" ? "user" : "assistant"}
                fullWidth={message.role === "assistant"}
              >
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                  {message.metadata?.pending && (
                    <span className="ml-2 inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
                  )}
                </div>
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
                    {message.run.logs?.entries?.length > 0 && (
                      <CollapsedLogViewer
                        taskId={taskId}
                        logs={message.run.logs.entries.map((l: TaskLog) =>
                          typeof l.log_line === "string"
                            ? l.log_line
                            : JSON.stringify(l.log_line),
                        )}
                      />
                    )}
                  </div>
                )}
              </ChatBubble>
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
              onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
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
            <div className="flex items-center gap-2 p-2">
              {/* Mode button */}
              <button
                onClick={cycleRunMode}
                className="flex items-center gap-1 px-2 py-2 rounded-md text-xs font-medium bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-colors touch-target"
                title="Shift+Tab to cycle modes"
              >
                <span>{getModeConfig(mode).icon}</span>
                <span className="hidden sm:inline">{getModeConfig(mode).label}</span>
              </button>

              {/* Input */}
              <div className="flex-1">
                <div className="group relative flex items-center rounded-md border border-gray-300 bg-white focus-within:border-blue-500 transition-colors">
                  <input
                    type="text"
                    placeholder="Type your message…"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isSending}
                    className="flex-1 px-3 py-2 text-gray-900 placeholder:text-gray-500 bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:text-gray-400"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isSending}
                    className="m-1 w-8 h-8 rounded-md bg-gray-900 text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors flex items-center justify-center touch-target"
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