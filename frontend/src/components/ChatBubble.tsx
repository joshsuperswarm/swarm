import type { ReactNode } from "react";

interface ChatBubbleProps {
  variant: 'assistant' | 'user' | 'error';
  children: ReactNode;
  fullWidth?: boolean;
}

export function ChatBubble({ variant, children, fullWidth = false }: ChatBubbleProps) {
  const base = fullWidth ? "w-full rounded-lg border p-4 text-sm shadow-sm" : "max-w-md rounded-lg border p-4 text-sm shadow-sm";
  const styles = {
    assistant: "bg-gray-900 border-gray-800 text-gray-100 self-end",
    user: "bg-white border-gray-200 text-gray-900 self-start",
    error: "bg-red-50 border-red-200 text-red-900 self-end"
  } as const;

  return <div className={`${base} ${styles[variant]}`}>{children}</div>;
}