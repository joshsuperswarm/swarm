import type { AgentTodo } from "@/types/generated/AgentTodo";
import { cn } from "@/lib/utils";

interface TodoListProps {
  todos: AgentTodo[];
  loading?: boolean;
}

// Status icons mapping
const statusIcons = {
  pending: "⏳",
  in_progress: "🔄", 
  completed: "✅",
} as const;

export function TodoList({ todos, loading }: TodoListProps) {
  if (loading) {
    return (
      <div className="space-y-3 mb-6">
        <h3 className="text-sm font-semibold">Todos</h3>
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
            <span className="text-sm text-muted-foreground">Loading todos...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-6">
      <h3 className="text-sm font-semibold">Todos</h3>
      
      {todos.length === 0 ? (
        <div className="bg-muted/30 rounded-lg p-4">
          <p className="text-sm text-muted-foreground italic">No todos yet</p>
        </div>
      ) : (
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="space-y-3">
            {todos.map((todo) => (
              <div
                key={todo.todo_id}
                className={cn(
                  "flex items-start space-x-3 p-3 rounded-md border",
                  todo.status === "completed" 
                    ? "bg-gray-50 text-gray-500 border-gray-200" 
                    : "bg-white border-gray-200"
                )}
              >
                <div className="flex-shrink-0 text-sm">
                  {statusIcons[todo.status]}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm",
                    todo.status === "completed" && "line-through"
                  )}>
                    {todo.content}
                  </p>
                  
                  {todo.updated_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Updated {new Date(todo.updated_at).toLocaleString()}
                    </p>
                  )}
                </div>
                
                <div className="flex-shrink-0">
                  <span className={cn(
                    "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                    todo.status === "completed" && "bg-green-100 text-green-800",
                    todo.status === "in_progress" && "bg-blue-100 text-blue-800", 
                    todo.status === "pending" && "bg-yellow-100 text-yellow-800"
                  )}>
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