import { useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { TodoList } from "@/components/TodoList";
import { CollapsedTodoList } from "@/components/CollapsedTodoList";
import { CollapsedLogViewer } from "@/components/CollapsedLogViewer";
import { TaskLogViewer } from "@/components/TaskLogViewer";
import { mockTask, mockConversation, mockTodos, mockLogs } from "@/mock/taskMock";
import { statuses } from "@/data/data";
import type { RunMode } from "@/services/api";

function AgentDone() {
  const [showLogs, setShowLogs] = useState(false);
  
  return (
    <div>
      <p className="mb-2">
        ✓ {mockTask.github_pr_url ? "All done – PR opened!" : "Done."}
      </p>
      <button 
        onClick={() => setShowLogs(x => !x)} 
        className="text-xs underline"
      >
        {showLogs ? "Hide logs" : "Show logs"}
      </button>
      {showLogs && (
        <div className="mt-2">
          <TaskLogViewer taskId={mockTask.task_id} hideHeader logs={mockLogs} />
        </div>
      )}
    </div>
  );
}

// Canned response data
const cannedTodos = [
  { todo_id: "c1", content: "Analyze the request", status: "completed", updated_at: null, priority: "high" },
  { todo_id: "c2", content: "Implement solution", status: "in_progress", updated_at: null, priority: "high" },
  { todo_id: "c3", content: "Test changes", status: "pending", updated_at: null, priority: "medium" },
];

const cannedLogs = [
  '{"level":"info","msg":"processing user request"}',
  '{"level":"info","msg":"analyzing requirements"}',
  '{"level":"info","msg":"starting implementation"}',
];

export function TaskChatPage() {
  // Use mockTask regardless of id (keep simple)
  const finished = ["done", "failed", "pr_opened"].includes(mockTask.status);
  
  // Get status configuration
  const status = statuses.find((s) => s.value === mockTask.status);
  
  // Chat input state
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState<RunMode>("plan");
  
  // Prepend task description as first message
  const initialConversation = [
    {
      id: "task-description",
      side: "left" as const,
      content: mockTask.description,
      timestamp: "2024-01-15T09:59:00Z"
    },
    ...mockConversation.slice(1) // Skip the original first message since we're replacing it
  ];
  
  const [chatMessages, setChatMessages] = useState(initialConversation);
  
  // Mode cycling
  const runModes: RunMode[] = ['plan', 'execute', 'review'];
  
  const cycleRunMode = () => {
    const currentIndex = runModes.indexOf(mode);
    const nextIndex = (currentIndex + 1) % runModes.length;
    setMode(runModes[nextIndex]);
  };
  
  const getModeConfig = (mode: RunMode) => {
    switch (mode) {
      case 'execute':
        return { icon: '→', label: 'Execute', color: 'text-green-600' };
      case 'plan':
        return { icon: '◊', label: 'Plan', color: 'text-blue-600' };
      case 'review':
        return { icon: '◈', label: 'Review', color: 'text-purple-600' };
    }
  };
  
  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    // Add user message
    const userMessage = {
      id: `user-${Date.now()}`,
      side: "left" as const,
      content: inputValue.trim(),
      timestamp: new Date().toISOString()
    };
    
    // Add canned agent response
    const agentMessage = {
      id: `agent-${Date.now()}`,
      side: "right" as const,
      content: "I'll help you with that. Let me work on this request.",
      timestamp: new Date().toISOString(),
      showTodos: true,
      logs: cannedLogs
    };
    
    setChatMessages(prev => [...prev, userMessage, agentMessage]);
    setInputValue("");
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
  
  const messages = chatMessages.map(msg => {
    let content;
    
    if (msg.side === "left") {
      content = <p className="whitespace-pre-wrap">{msg.content}</p>;
    } else {
      // Agent message
      if (msg.showCollapsedTodos) {
        content = (
          <div>
            <p className="mb-2">{msg.content}</p>
            <CollapsedTodoList todos={mockTodos} />
            {msg.logs && (
              <div className="mt-2">
                <CollapsedLogViewer taskId={mockTask.task_id} logs={msg.logs} />
              </div>
            )}
          </div>
        );
      } else if (msg.showTodos) {
        content = (
          <div>
            <p className="mb-2">{msg.content}</p>
            <TodoList todos={cannedTodos} />
            {msg.logs && (
              <div className="mt-2">
                <CollapsedLogViewer taskId={mockTask.task_id} logs={msg.logs} />
              </div>
            )}
          </div>
        );
      } else {
        content = <p>{msg.content}</p>;
      }
    }
    
    return {
      id: msg.id,
      side: msg.side,
      node: content
    };
  });
  
  // Add final message if task is finished
  if (finished) {
    messages.push({
      id: "agent-finished",
      side: "right" as const,
      node: <AgentDone />
    });
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Task Header */}
      <div className="flex-shrink-0 p-3 bg-linear-bg">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono text-linear-text-muted bg-white border border-linear-border px-2 py-1 rounded">
              #{mockTask.task_id}
            </span>
            <h1 className="text-xl font-semibold text-linear-text">{mockTask.title}</h1>
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
        {messages.map(m => (
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
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 pr-10 rounded-md border border-linear-border bg-white text-linear-text placeholder:text-linear-text-muted focus:border-linear-accent focus:outline-none transition-colors duration-150"
            />
            
            {/* Send button inside input */}
            <button 
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-sm bg-linear-text text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors duration-150 flex items-center justify-center"
              title="Send message"
            >
              <span className="text-xs">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}