import { useState } from "react";
import type { AgentTodo } from "@/types/generated/AgentTodo";
import { TodoList } from "./TodoList";

interface CollapsedTodoListProps {
  todos: AgentTodo[];
}

export function CollapsedTodoList({ todos }: CollapsedTodoListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const completedCount = todos.filter(t => t.status === "completed").length;
  const totalCount = todos.length;
  
  return (
    <div>
      <button 
        onClick={() => setIsExpanded(!isExpanded)} 
        className="text-sm font-medium flex items-center gap-2 w-full mb-2"
      >
        <span>{isExpanded ? "−" : "+"}</span>
        Progress: {completedCount}/{totalCount} tasks completed
      </button>
      
      {isExpanded && (
        <div>
          <TodoList todos={todos} />
        </div>
      )}
    </div>
  );
}