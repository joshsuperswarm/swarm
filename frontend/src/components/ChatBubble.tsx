import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from '@/components/ui/button';
import { Copy, ChevronDown, ChevronUp, Check } from 'lucide-react';

interface ChatBubbleProps {
  variant: 'assistant' | 'user' | 'error';
  children: ReactNode;
  fullWidth?: boolean;
  content?: string; // For copy functionality
}

export function ChatBubble({ variant, children, fullWidth = false, content }: ChatBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const base = fullWidth
    ? "w-full rounded-lg border p-3 md:p-4 text-sm shadow-sm"
    : "w-full md:max-w-md rounded-lg border p-3 md:p-4 text-sm shadow-sm";
    
  // Use task page color scheme for user messages, keep assistant messages as white
  const styles = {
    // assistant is now LEFT (self-start) - keep white background
    assistant: "bg-white border-gray-200 text-gray-900 self-start",
    // user is now RIGHT (self-end) - use task description color scheme
    user: "bg-gray-100 border-gray-200 text-gray-700 self-end",
    error: "bg-red-50 border-red-200 text-red-900 self-end"
  } as const;

  const handleCopy = () => {
    if (!content) return;
    
    navigator.clipboard.writeText(content).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 10000);
    }).catch(() => {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 10000);
    });
  };

  // For assistant messages, add copy functionality with hover but no expand/collapse
  if (variant === 'assistant') {
    return (
      <div className={`${base} ${styles[variant]} relative group`}>
        <div className="leading-relaxed [word-break:break-word]">
          {children}
        </div>
        
        {/* Hover-revealed copy button for assistant messages */}
        {content && (
          <div className="absolute top-2 right-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className={`h-6 px-2 opacity-0 group-hover:opacity-100 transition-all bg-white border border-gray-200 hover:bg-gray-50 ${
                isCopied ? 'opacity-100' : ''
              }`}
              title={isCopied ? 'Copied!' : 'Copy message'}
            >
              {isCopied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  <span className="text-xs">Copied</span>
                </>
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const shouldShowExpandCollapse = content && content.split('\n').length > 10;
  const shouldCollapse = shouldShowExpandCollapse && !isExpanded;

  if (shouldCollapse) {
    // Collapsed view with gradient fade
    return (
      <div className={`${base} ${styles[variant]} relative overflow-hidden group`}>
        <div className="whitespace-pre-wrap leading-relaxed">
          {content?.split('\n').slice(0, 5).join('\n')}
        </div>
        <div className={`absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t ${
          variant === 'user' ? 'from-gray-100' : variant === 'error' ? 'from-red-50' : 'from-white'
        } to-transparent pointer-events-none`}></div>
        
        {/* Hover-revealed copy button */}
        {content && (
          <div className="absolute top-2 right-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className={`h-6 px-2 opacity-0 group-hover:opacity-100 transition-all bg-white border border-gray-200 hover:bg-gray-50 ${
                isCopied ? 'opacity-100' : ''
              }`}
              title={isCopied ? 'Copied!' : 'Copy message'}
            >
              {isCopied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  <span className="text-xs">Copied</span>
                </>
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}
        
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="h-8 px-4 text-xs text-muted-foreground hover:text-foreground bg-white border-gray-300 shadow-sm"
          >
            <ChevronDown className="h-3 w-3 mr-1" />
            Expand ({content?.split('\n').length} lines)
          </Button>
        </div>
      </div>
    );
  }

  // Expanded view with copy and collapse controls (for user and error messages only)
  return (
    <div className={`${base} ${styles[variant]} relative group`}>
      <div className="whitespace-pre-wrap leading-relaxed">
        {children}
      </div>
      
      {/* Hover-revealed controls */}
      <div className="absolute top-2 right-2 flex gap-1">
        {shouldShowExpandCollapse && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-all bg-white border border-gray-200 hover:bg-gray-50"
            title="Collapse message"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
        )}
        
        {content && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className={`h-6 px-2 opacity-0 group-hover:opacity-100 transition-all bg-white border border-gray-200 hover:bg-gray-50 ${
              isCopied ? 'opacity-100' : ''
            }`}
            title={isCopied ? 'Copied!' : 'Copy message'}
          >
            {isCopied ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                <span className="text-xs">Copied</span>
              </>
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
      
      {/* Bottom collapse button for long messages */}
      {shouldShowExpandCollapse && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(false)}
            className="h-8 px-4 text-xs text-muted-foreground hover:text-foreground bg-white border-gray-300 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronUp className="h-3 w-3 mr-1" />
            Collapse
          </Button>
        </div>
      )}
    </div>
  );
}