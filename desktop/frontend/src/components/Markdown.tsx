import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

type Props = { content: string; streaming?: boolean };

export default function Markdown({ content, streaming }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Attach a copy button to each code block
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const blocks = root.querySelectorAll('pre');
    blocks.forEach((pre) => {
      // avoid duplicate buttons
      if (pre.querySelector('[data-copy-btn]')) return;

      const btn = document.createElement('button');
      btn.dataset.copyBtn = '1';
      btn.className = 'absolute right-2 top-2 rounded-md border bg-white/80 px-2 py-1 text-xs text-gray-700 hover:bg-white';
      btn.textContent = 'Copy';
      btn.onclick = async () => {
        const code = pre.querySelector('code')?.textContent ?? '';
        await navigator.clipboard.writeText(code);
        btn.textContent = 'Copied';
        setTimeout(() => (btn.textContent = 'Copy'), 1200);
      };

      pre.classList.add('relative');
      pre.appendChild(btn);
    });
  }, [content]);

  return (
    <div ref={rootRef} className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}