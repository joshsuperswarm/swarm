import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

/**
 * Clean Markdown renderer:
 * - Inline code: compact, monospace chip.
 * - Fenced code: minimal card with language label and Copy button (React-based).
 */
type Props = { content: string; streaming?: boolean };

export default function Markdown({ content }: Props) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        // Custom renderers
        components={{
          // Inline code: `like_this`
          code({ inline, className, children, ...props }) {
            const txt = String(children ?? "");
            const langMatch = /language-(\w+)/.exec(className || "");

            if (inline) {
              return (
                <code
                  className="rounded-md bg-gray-100 border border-gray-200 px-1.5 py-0.5 font-mono text-[0.9em] text-gray-800"
                  style={{ fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace" }}
                  {...props}
                >
                  {txt}
                </code>
              );
            }

            // Fenced code block
            const lang = langMatch?.[1] ?? "text";

            return (
              <div className="my-4 overflow-hidden rounded-xl border border-gray-300 bg-gray-900 shadow-md">
                <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-3 py-1.5">
                  <span className="select-none text-xs font-medium uppercase tracking-wide text-gray-400">
                    {lang}
                  </span>
                  <CopyButton text={txt} />
                </div>
                <pre className="max-h-[560px] overflow-auto px-4 py-3 bg-gray-900">
                  <code 
                    className="block font-mono text-sm leading-relaxed text-gray-100"
                    style={{ fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace" }}
                  >
                    {txt}
                  </code>
                </pre>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [label, setLabel] = React.useState("Copy");
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setLabel("Copied");
        setTimeout(() => setLabel("Copy"), 1200);
      }}
      className="rounded-md border border-gray-600 bg-gray-700 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
      aria-label="Copy code"
      type="button"
    >
      {label}
    </button>
  );
}