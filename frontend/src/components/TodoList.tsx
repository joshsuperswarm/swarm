import type { AgentTodo } from "@/types/generated/AgentTodo";
import { cn } from "@/lib/utils";
import { TodoStatusIcon } from "./TodoStatusIcon";

interface TodoListProps {
  todos: AgentTodo[];
  loading?: boolean;
}


export function TodoList({ todos, loading }: TodoListProps) {
  if (loading) {
    return (
      <div>
        <div className="bg-white border border-linear-border rounded-md p-2">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-3 w-3 border border-linear-border border-t-linear-accent"></div>
            <span className="text-sm text-linear-text-muted">Loading todos...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {todos.length === 0 ? (
        <div className="bg-white border border-linear-border rounded-md p-2">
          <p className="text-sm text-linear-text-muted">No todos yet</p>
        </div>
      ) : (
        <div className="bg-white border border-linear-border rounded-md p-1">
          <div className="space-y-1">
            {todos.map((todo) => (
              <div
                key={todo.todo_id}
                className={cn(
                  "flex items-center space-x-3 p-2 rounded-sm transition-colors duration-150 ease-out",
                  todo.status === "completed" 
                    ? "text-linear-text-muted" 
                    : "text-linear-text hover:bg-linear-bg-subtle"
                )}
              >
                <div className="flex-shrink-0">
                  <TodoStatusIcon completed={todo.status === 'completed'} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-normal leading-5",
                    todo.status === "completed" && "line-through"
                  )}>
                    {todo.content}
                  </p>
                  
                  {todo.updated_at && (
                    <p className="text-xs text-linear-text-muted mt-1">
                      Updated {new Date(todo.updated_at).toLocaleString()}
                    </p>
                  )}
                </div>
                
                <div className="flex-shrink-0">
                  <span className="text-xs text-linear-text-muted font-normal">
                    {todo.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}