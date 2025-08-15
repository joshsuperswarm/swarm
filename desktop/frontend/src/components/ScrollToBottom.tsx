import { useEffect, useState } from "react";

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
    <div className="fixed bottom-24 md:bottom-28 inset-x-0 z-40">
      <div className="mx-auto w-full max-w-3xl flex justify-center">
        <button
          onClick={() => container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })}
          className="px-3 py-1.5 rounded-full text-xs border bg-white shadow hover:bg-gray-50"
          aria-label="Jump to latest"
        >
          Jump to latest ↓
        </button>
      </div>
    </div>
  );
}