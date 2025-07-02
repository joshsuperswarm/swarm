import type { Task } from "@/types";

// Simple task list without complex DataTable for now
const sampleTasks: Task[] = [
  {
    id: "TASK-8782",
    title: "Implement user authentication with JWT tokens",
    status: "in progress",
    label: "feature",
    priority: "high",
  },
  {
    id: "TASK-7878",
    title: "Fix memory leak in data processing pipeline",
    status: "backlog",
    label: "bug",
    priority: "urgent",
  },
  {
    id: "TASK-7839",
    title: "Update API documentation for v2.0 release",
    status: "todo",
    label: "documentation",
    priority: "medium",
  },
  {
    id: "TASK-5562",
    title: "Optimize database query performance",
    status: "done",
    label: "improvement",
    priority: "high",
  },
  {
    id: "TASK-8686",
    title: "Add real-time notifications system",
    status: "canceled",
    label: "feature",
    priority: "low",
  },
];

export function TasksPageSimple() {
  return (
    <div className="h-full flex-1 flex-col space-y-8 p-8 md:flex">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome back!</h2>
          <p className="text-muted-foreground">
            Here&apos;s a list of your tasks for this month!
          </p>
        </div>
      </div>
      
      <div className="rounded-md border">
        <div className="p-4">
          <h3 className="text-lg font-medium mb-4">Tasks</h3>
          <div className="space-y-2">
            {sampleTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-mono text-muted-foreground">
                    {task.id}
                  </span>
                  <span className="font-medium">{task.title}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-1 text-xs rounded-md bg-blue-100 text-blue-800">
                    {task.label}
                  </span>
                  <span className="px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-800">
                    {task.status}
                  </span>
                  <span className="px-2 py-1 text-xs rounded-md bg-orange-100 text-orange-800">
                    {task.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}