import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

/**
 * Clean Markdown renderer:
 * - Inline code: compact, monospace chip.
 * - Single-line fenced code: render as inline chip (prevents bulky blocks for tiny snippets).
 * - Multi-line fenced code: dark card with language label + Copy.
 */

type Props = { content: string; streaming?: boolean };

/** Recursively flatten ReactMarkdown code children to a raw string. */
function flattenToText(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenToText).join("");
  // React element with props.children
  if (typeof node === "object" && "props" in node) {
    return flattenToText((node as any).props?.children);
  }
  try {
    // Last resort—avoid "[object Object]"
    return "";
  } catch {
    return "";
  }
}

export default function Markdown({ content }: Props) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
        components={{
          code({ inline, className, children, ...props }) {
            const raw = flattenToText(children);
            const txt = raw.replace(/\n+$/g, ""); // trim trailing newlines common in fences
            const langMatch = /language-(\w+)/.exec(className || "");
            const lang = langMatch?.[1] ?? "bash";

            // Heuristic: treat as inline chip if (a) inline or (b) single line & short
            const isSingleLine = !txt.includes("\n");
            if (inline || isSingleLine) {
              return (
                <code
                  className="rounded-md bg-gray-100 border border-gray-200 px-1.5 py-0.5 font-mono text-[0.9em] text-gray-800"
                  style={{ fontFamily: "'Fira Code','Consolas','Monaco',monospace" }}
                  {...props}
                >
                  {txt}
                </code>
              );
            }

            // Multi-line fenced block -> dark card
            return (
              <div className="my-4 overflow-hidden rounded-xl border border-gray-300 bg-gray-900 shadow-md">
                <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-3 py-1.5">
                  <span className="select-none text-xs font-medium tracking-wide text-gray-300">
                    {lang}
                  </span>
                  <CopyButton text={txt} />
                </div>
                <pre className="max-h-[560px] overflow-auto px-4 py-3 bg-gray-900">
                  <code
                    className="block font-mono text-sm leading-relaxed text-gray-100"
                    style={{ fontFamily: "'Fira Code','Consolas','Monaco',monospace" }}
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