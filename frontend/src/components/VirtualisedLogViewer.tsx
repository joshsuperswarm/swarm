import React, { useEffect, useRef } from 'react';

export const VirtualisedLogViewer: React.FC<{ lines: string[]; height?: number }> = ({
  lines,
  height = 384, // 24rem ≈ existing h-96
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLineCountRef = useRef(lines.length);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (lines.length > prevLineCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevLineCountRef.current = lines.length;
  }, [lines.length]);

  return (
    <div 
      ref={scrollRef}
      style={{ height }}
      className="overflow-y-auto overflow-x-hidden w-full"
    >
      {lines.length === 0 ? (
        <div className="text-gray-500 text-xs p-2">No logs yet...</div>
      ) : (
        lines.map((line, index) => (
          <pre 
            key={index} 
            className="m-0 mb-2 p-2 text-xs leading-relaxed whitespace-pre-wrap break-words text-gray-100 font-mono"
          >
            {line}
          </pre>
        ))
      )}
    </div>
  );
};