import { useState } from "react";
import { useParams } from "react-router-dom";
import { CollapsedTodoList } from "@/components/CollapsedTodoList";
import { TaskLogViewer } from "@/components/TaskLogViewer";
import { statuses } from "@/data/data";
import { useTaskDetailsQuery, useSendMessageMutation } from "@/services/queries";
import { useRunMode } from "@/hooks/useRunMode";
import { User, Bot, Terminal, AlertCircle } from 'lucide-react';
// import type { RunMode } from "@/services/api";

function AgentDone({ taskId, prUrl, logs, todos }: { 
  taskId: number; 
  prUrl?: string; 
  logs?: { entries: unknown[]; total_count: number; has_more: boolean };
  todos?: unknown[];
}) {
  const [showLogs, setShowLogs] = useState(false);
  const [showTodos, setShowTodos] = useState(true);
  
  const logCount = logs?.total_count || 0;
  const todoCount = todos?.length || 0;
  
  return (
    <div className="space-y-3">
      <p className="font-medium">
        ✓ {prUrl ? "All done – PR opened!" : "Task completed"}
      </p>
      
      {/* Todos Section */}
      {todoCount > 0 && (
        <div className="border border-linear-border rounded-md p-3">
          <button 
            onClick={() => setShowTodos(x => !x)} 
            className="text-sm font-medium flex items-center gap-2 w-full"
          >
            <span>{showTodos ? "▼" : "▶"}</span>
            Todos ({todoCount})
          </button>
          {showTodos && (
            <div className="mt-2">
              <CollapsedTodoList todos={todos || []} />
            </div>
          )}
        </div>
      )}
      
      {/* Logs Section */}
      {logCount > 0 && (
        <div className="border border-linear-border rounded-md p-3">
          <button 
            onClick={() => setShowLogs(x => !x)} 
            className="text-sm font-medium flex items-center gap-2 w-full"
          >
            <span>{showLogs ? "▼" : "▶"}</span>
            Logs ({logCount})
          </button>
          {showLogs && logs?.entries && (
            <div className="mt-2 max-h-96 overflow-y-auto">
              <TaskLogViewer taskId={taskId} hideHeader logs={logs.entries} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskChatPage() {
  const { id } = useParams<{ id: string }>();
  const taskId = parseInt(id || "0", 10);
  
  // Use unified task details query
  const { data: taskDetails, isLoading } = useTaskDetailsQuery(taskId);
  const sendMessage = useSendMessageMutation(taskId);
  
  // Extract data from unified response
  const task = taskDetails?.task;
  const messages = taskDetails?.messages || [];
  const logs = taskDetails?.logs;
  const todos = taskDetails?.todos || [];
  const { mode, cycleRunMode, getModeConfig } = useRunMode("execute");
  
  // Chat input state
  const [inputValue, setInputValue] = useState("");
  
  if (isLoading || !task) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-linear-text-muted">Loading task...</p>
        </div>
      </div>
    );
  }
  
  const currentRunStatus = taskDetails?.current_run?.status;
  const finished = ["done", "failed", "pr_opened"].includes(currentRunStatus || "");
  const status = statuses.find((s) => s.value === currentRunStatus);
  
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
  
  const getMessageIcon = (role: string, type?: string) => {
    if (role === 'user') return <User className="w-5 h-5" />;
    if (type === 'error') return <AlertCircle className="w-5 h-5" />;
    if (type === 'tool_use') return <Terminal className="w-5 h-5" />;
    return <Bot className="w-5 h-5" />;
  };

  const getMessageBubbleClass = (role: string, type?: string) => {
    if (role === 'user') {
      return 'bg-blue-600 text-white ml-12';
    }
    if (type === 'error') {
      return 'bg-red-50 text-red-900 border border-red-200 mr-12';
    }
    if (type === 'code') {
      return 'bg-gray-900 text-gray-100 font-mono text-sm mr-12';
    }
    return 'bg-white text-gray-900 border border-gray-200 mr-12';
  };

  const getAvatarClass = (role: string, type?: string) => {
    if (role === 'user') {
      return 'bg-blue-600 text-white';
    }
    if (type === 'error') {
      return 'bg-red-100 text-red-600';
    }
    return 'bg-gray-100 text-gray-600';
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Task Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
              #{task.id}
            </span>
            <h1 className="text-xl font-semibold text-gray-900">{task.title}</h1>
          </div>
          
          {/* Task Status */}
          {status && (
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Status
              </span>
              {status.icon && (
                <status.icon className="h-3 w-3 text-gray-500" />
              )}
              <span className="text-sm text-gray-900">{status.label}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && !finished && !sendMessage.isPending ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Start a conversation with Claude Code</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
          <div key={message.id} className="flex items-start space-x-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getAvatarClass(message.role)}`}>
              {getMessageIcon(message.role)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className={`rounded-lg p-4 ${getMessageBubbleClass(message.role)}`}>
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {formatTime(message.created_at || new Date().toISOString())}
              </div>
            </div>
          </div>
          ))
        )}
        
        {/* Add final message if task is finished */}
        {finished && (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <Bot className="w-5 h-5 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="bg-white text-gray-900 border border-gray-200 rounded-lg p-4 mr-12">
                <AgentDone taskId={taskId} prUrl={task.github_pr_url || undefined} logs={logs} todos={todos} />
              </div>
            </div>
          </div>
        )}
        
        {sendMessage.isPending && (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <Bot className="w-5 h-5 text-gray-600" />
            </div>
            <div className="flex-1">
              <div className="bg-white border border-gray-200 rounded-lg p-4 mr-12">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-gray-500 text-sm">Claude is thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          {/* Mode indicator */}
          <button
            onClick={cycleRunMode}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-colors duration-150 ease-out"
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
              className="w-full px-3 py-2 pr-10 rounded-md border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none transition-colors duration-150 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            
            {/* Send button inside input */}
            <button 
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || finished || sendMessage.isPending}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-sm bg-gray-900 text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors duration-150 flex items-center justify-center"
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