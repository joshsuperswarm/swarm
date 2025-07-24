import { useState } from "react";
import type { AgentTodo } from "@/types/generated/AgentTodo";
import { Button } from "@/components/ui/button";
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
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/70 font-normal">
          Progress: {completedCount}/{totalCount} tasks completed
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-6 w-6 p-0 text-white/50 hover:text-white/70"
          title={isExpanded ? "Hide details" : "Show details"}
        >
          {isExpanded ? "−" : "+"}
        </Button>
      </div>
      
      {isExpanded && (
        <div>
          <TodoList todos={todos} />
        </div>
      )}
    </div>
  );
}