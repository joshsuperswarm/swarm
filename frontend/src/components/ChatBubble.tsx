import type { ReactNode } from "react";

interface ChatBubbleProps {
  side: "left" | "right";
  children: ReactNode;
}

export function ChatBubble({ side, children }: ChatBubbleProps) {
  const base = "max-w-[65%] rounded-lg border px-3 py-2 transition-all duration-150 ease-out text-sm";
  const left = "self-start bg-white border-linear-border text-linear-text";
  const right = "self-end bg-linear-text border-linear-text text-white";
  
  const className = `${base} ${side === "left" ? left : right}`;
  
  return (
    <div className={className}>
      {children}
    </div>
  );
}