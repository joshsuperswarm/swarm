import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../lib/cn";

type Props = { content: string; streaming?: boolean };

const normalizeBullets = (s: string) =>
  s.replace(/(^|\n)\s*•\s+/g, '$1- ');

export default function Markdown({ content }: Props) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-lg font-semibold text-gray-900 mb-3 mt-4 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold text-gray-900 mb-2 mt-4 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-900 mb-2 mt-3 first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="text-gray-900 mb-3 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-5 mb-3 space-y-1 text-gray-900">
              {children}
            </ul>
          ),
          ol: ({ className, ...props }) => (
            <ol
              {...props}
              className={cn(
                "list-decimal list-outside pl-5 mb-3 space-y-1 text-gray-900",
                className
              )}
            />
          ),
          li: ({ className, ...props }) => (
            <li
              {...props}
              className={cn("text-gray-900 leading-relaxed", className)}
            />
          ),
          pre: ({ children }) => <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-3 overflow-x-auto text-sm" style={{ fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace" }}>{children}</pre>,
          code: ({ children, ...props }) => {
            const isInline = !props.className?.includes('language-')
            return isInline ? (
              <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono" style={{ fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace" }}>{children}</code>
            ) : (
              <code className="text-gray-800 font-mono text-sm leading-relaxed" style={{ fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace" }}>{children}</code>
            )
          },
          blockquote: ({ children }) => <blockquote className="border-l-2 border-gray-200 pl-4 mb-3 text-gray-700 italic">{children}</blockquote>,
          a: ({ href, children }) => <a href={href as string} target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:text-gray-700 underline decoration-1 underline-offset-2">{children}</a>,
          table: ({ children }) => <div className="overflow-x-auto mb-3"><table className="w-full border-collapse border border-gray-200 rounded-md">{children}</table></div>,
          thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
          th: ({ children }) => <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900">{children}</th>,
          td: ({ children }) => <td className="border border-gray-200 px-3 py-2 text-sm text-gray-900">{children}</td>,
          hr: () => <hr className="border-0 border-t border-gray-200 my-4" />,
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
          em: ({ children }) => <em className="italic text-gray-900">{children}</em>,
        }}
      >
        {normalizeBullets(content)}
      </ReactMarkdown>
    </div>
  );
}