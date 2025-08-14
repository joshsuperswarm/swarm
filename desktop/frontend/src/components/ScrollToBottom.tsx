import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";

export default function ScrollToBottom({ container }: { container: HTMLElement | null }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!container) return;
    const onScroll = () => {
      const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 160;
      setShow(!nearBottom);
    };
    onScroll();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [container]);

  if (!show) return null;

  return (
    <button
      onClick={() => container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })}
      className="fixed bottom-20 right-6 z-40 rounded-full border bg-white px-3 py-2 text-sm shadow-md hover:bg-gray-50"
      aria-label="Scroll to bottom"
    >
      <div className="flex items-center gap-1">
        <ArrowDown className="h-4 w-4" />
        <span>New messages</span>
      </div>
    </button>
  );
}