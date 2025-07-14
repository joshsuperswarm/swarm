import { useEffect, useState, useRef } from "react";
import { ApiService } from "@/services/api";
import type { Task } from "@/types";

const TERMINAL = ["done", "failed", "pr_opened"];

export function useTaskPolling(task: Task | null, interval = 2000) {
  const [latest, setLatest] = useState<Task | null>(task);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!task) return;

    setLatest(task);                            // sync first render
    const finished = TERMINAL.includes(task.status ?? "");
    if (finished) return;

    const poll = async () => {
      try {
        const { task: fresh } = await ApiService.getTask(task.id);
        setLatest(prev =>
          prev && prev.updated_at === fresh.updated_at ? prev : fresh
        );
        if (TERMINAL.includes(fresh.status ?? "") && timer.current) {
          clearInterval(timer.current);
        }
      } catch (err) {
        console.error("task poll failed", err);
      }
    };
    poll();                                     // immediate hit
    timer.current = setInterval(poll, interval);
    return () => timer.current && clearInterval(timer.current);
  }, [task, interval]);

  return latest;
}