import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Args = {
  containerRef: React.RefObject<HTMLElement | null>;
  bottomRef: React.RefObject<HTMLElement | null>;
  itemCount: number;
  threshold?: number;
};

export function useStickToBottom({
  containerRef,
  bottomRef,
  itemCount,
  threshold = 16,
}: Args) {
  const [showJump, setShowJump] = useState(false);
  const [autoStick, setAutoStick] = useState(true);
  const isInitialLoad = useRef(true);
  const prevCountRef = useRef(itemCount);

  const scrollToBottomNow = () => {
    const el = containerRef.current;
    if (!el) return;

    // If the element actually scrolls, use scrollTop.
    // Otherwise, fall back to scrolling the window with scrollIntoView.
    const hasOwnScroll = el.scrollHeight > el.clientHeight + 1;
    if (hasOwnScroll) {
      el.scrollTop = el.scrollHeight;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }
  };

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const added = itemCount > prevCountRef.current;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

    if (isInitialLoad.current) {
      // First paint: jump immediately, then double-rAF to catch layout shifts/images
      scrollToBottomNow();
      const id1 = requestAnimationFrame(scrollToBottomNow);
      const id2 = requestAnimationFrame(scrollToBottomNow);
      isInitialLoad.current = false;
      return () => {
        cancelAnimationFrame(id1);
        cancelAnimationFrame(id2);
      };
    }

    if (added && (nearBottom || autoStick)) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }

    prevCountRef.current = itemCount;
  }, [itemCount, autoStick, threshold]); // refs are stable

  // Keep showJump/autoStick in sync with user scroll position
  const onScroll: React.UIEventHandler<HTMLElement> = (e) => {
    const el = e.currentTarget;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

    setShowJump(!nearBottom);
    setAutoStick(nearBottom);
  };

  const jumpToLatest = () => {
    setAutoStick(true);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  return { onScroll, showJump, jumpToLatest, setAutoStick };
}