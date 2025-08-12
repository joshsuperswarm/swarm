import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings - smaller than default, consistent with Linear's approach
          h1: ({ children }) => (
            <h1 className="text-lg font-semibold text-gray-900 mb-3 mt-4 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold text-gray-900 mb-2 mt-4 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-gray-900 mb-2 mt-3 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-medium text-gray-900 mb-1 mt-3 first:mt-0">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-medium text-gray-700 mb-1 mt-2 first:mt-0">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-xs font-medium text-gray-700 mb-1 mt-2 first:mt-0">
              {children}
            </h6>
          ),
          
          // Paragraphs - clean spacing
          p: ({ children }) => (
            <p className="text-gray-900 mb-3 last:mb-0 leading-relaxed">
              {children}
            </p>
          ),
          
          // Lists - minimal, clean
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-3 space-y-1 text-gray-900">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-3 space-y-1 text-gray-900">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-900 leading-relaxed">
              {children}
            </li>
          ),
          
          // Code blocks - subtle, not overwhelming
          pre: ({ children }) => (
            <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-3 overflow-x-auto text-sm">
              {children}
            </pre>
          ),
          code: ({ children, ...props }) => {
            const isInline = !props.className?.includes('language-');
            return isInline ? (
              <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">
                {children}
              </code>
            ) : (
              <code className="text-gray-800 font-mono text-sm leading-relaxed">
                {children}
              </code>
            );
          },
          
          // Blockquotes - clean, minimal
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-gray-200 pl-4 mb-3 text-gray-700 italic">
              {children}
            </blockquote>
          ),
          
          // Links - subtle, consistent with brand
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 underline decoration-1 underline-offset-2"
            >
              {children}
            </a>
          ),
          
          // Tables - clean, minimal borders
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3">
              <table className="w-full border-collapse border border-gray-200 rounded-md">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-200 px-3 py-2 text-sm text-gray-900">
              {children}
            </td>
          ),
          
          // Horizontal rule - subtle
          hr: () => (
            <hr className="border-0 border-t border-gray-200 my-4" />
          ),
          
          // Strong and emphasis - subtle but clear
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-900">
              {children}
            </em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}