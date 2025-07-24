import { useState } from "react";
import { useParams } from "react-router-dom";
import { ChatBubble } from "@/components/ChatBubble";
import { CollapsedTodoList } from "@/components/CollapsedTodoList";
import { CollapsedLogViewer } from "@/components/CollapsedLogViewer";
import { TaskLogViewer } from "@/components/TaskLogViewer";
import { statuses } from "@/data/data";
import { useTaskQuery, useTaskMessagesQuery, useSendMessageMutation } from "@/services/queries";
import { useRunMode } from "@/hooks/useRunMode";
import type { RunMode } from "@/services/api";

function AgentDone({ taskId, prUrl }: { taskId: number; prUrl?: string }) {
  const [showLogs, setShowLogs] = useState(false);
  
  return (
    <div>
      <p className="mb-2">
        ✓ {prUrl ? "All done – PR opened!" : "Done."}
      </p>
      <button 
        onClick={() => setShowLogs(x => !x)} 
        className="text-xs underline"
      >
        {showLogs ? "Hide logs" : "Show logs"}
      </button>
      {showLogs && (
        <div className="mt-2">
          <TaskLogViewer taskId={taskId} hideHeader logs={[]} />
        </div>
      )}
    </div>
  );
}

export function TaskChatPage() {
  const { id } = useParams<{ id: string }>();
  const taskId = parseInt(id || "0", 10);
  
  // Real hooks instead of mocks
  const { data: task } = useTaskQuery(taskId);
  const { data: messages = [] } = useTaskMessagesQuery(taskId, task?.status);
  const sendMessage = useSendMessageMutation(taskId);
  const { mode, cycleRunMode, getModeConfig } = useRunMode("execute");
  
  // Chat input state
  const [inputValue, setInputValue] = useState("");
  
  if (!task) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-linear-text-muted">Loading task...</p>
        </div>
      </div>
    );
  }
  
  const finished = ["done", "failed", "pr_opened"].includes(task.status || "");
  const status = statuses.find((s) => s.value === task.status);
  
  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    sendMessage.mutate(
      { content: inputValue, mode },
      {
        onSuccess: () => {
          setInputValue("");
        },
        onError: (error) => {
          console.error("Failed to send message:", error);
        }
      }
    );
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
  
  const messageElements = messages.map(msg => {
    const side = msg.role === 'user' ? 'left' : 'right';
    
    let content;
    if (side === "left") {
      content = <p className="whitespace-pre-wrap">{msg.content}</p>;
    } else {
      // Assistant message - check metadata for logs and todos
      const logs = msg.metadata?.logs ?? [];
      const todos = msg.metadata?.todos ?? [];
      
      content = (
        <div>
          <p className="mb-2 whitespace-pre-wrap">{msg.content}</p>
          {todos.length > 0 && (
            <div className="mt-2">
              <CollapsedTodoList todos={todos} />
            </div>
          )}
          {logs.length > 0 && (
            <div className="mt-2">
              <CollapsedLogViewer taskId={taskId} logs={logs} />
            </div>
          )}
        </div>
      );
    }
    
    return {
      id: msg.id.toString(),
      side: side as 'left' | 'right',
      node: content
    };
  });
  
  // Add final message if task is finished
  if (finished) {
    messageElements.push({
      id: "agent-finished",
      side: "right" as const,
      node: <AgentDone taskId={taskId} prUrl={task.github_pr_url} />
    });
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Task Header */}
      <div className="flex-shrink-0 p-3 bg-linear-bg">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono text-linear-text-muted bg-white border border-linear-border px-2 py-1 rounded">
              #{task.task_id}
            </span>
            <h1 className="text-xl font-semibold text-linear-text">{task.title}</h1>
          </div>
          
          {/* Task Status */}
          {status && (
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-linear-text-muted uppercase tracking-wide">
                Status
              </span>
              {status.icon && (
                <status.icon className="h-3 w-3 text-linear-text-muted" />
              )}
              <span className="text-sm text-linear-text">{status.label}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col gap-3 p-3 overflow-y-auto">
        {messageElements.map(m => (
          <ChatBubble key={m.id} side={m.side}>
            {m.node}
          </ChatBubble>
        ))}
      </div>
      
      <div className="flex-shrink-0 p-3 bg-linear-bg flex justify-center">
        <div className="flex items-center gap-3 max-w-2xl w-full">
          {/* Mode indicator */}
          <button
            onClick={cycleRunMode}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-white border border-linear-border text-linear-text hover:bg-linear-bg-subtle transition-colors duration-150 ease-out"
            title="Shift+Tab to cycle modes"
          >
            <span>{getModeConfig(mode).icon}</span>
            <span>{getModeConfig(mode).label}</span>
          </button>
          
          {/* Input container */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={finished ? "Task completed" : "Type your message..."}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={finished || sendMessage.isPending}
              className="w-full px-3 py-2 pr-10 rounded-md border border-linear-border bg-white text-linear-text placeholder:text-linear-text-muted focus:border-linear-accent focus:outline-none transition-colors duration-150 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            
            {/* Send button inside input */}
            <button 
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || finished || sendMessage.isPending}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-sm bg-linear-text text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors duration-150 flex items-center justify-center"
              title="Send message"
            >
              <span className="text-xs">
                {sendMessage.isPending ? "..." : "→"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}