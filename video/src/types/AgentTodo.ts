export interface AgentTodo {
  todo_id: number;
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  updated_at: string;
}