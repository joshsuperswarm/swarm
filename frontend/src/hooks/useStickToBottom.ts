import { useLayoutEffect, useRef, useState } from "react";

type Args = {
  /** The scrollable container (e.g. the div with overflow-y-auto) */
  containerRef: React.RefObject<HTMLElement | null>;
  /** A sentinel div at the very bottom of your list */
  bottomRef: React.RefObject<HTMLElement | null>;
  /** Increase this number when new items are appended (e.g. messages.length) */
  itemCount: number;
  /** Pixels from bottom considered "close enough" to keep sticking */
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

  // Keep scroller stuck appropriately
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const added = itemCount > prevCountRef.current;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

    if (isInitialLoad.current) {
      // First paint: jump instantly to bottom
      el.scrollTop = el.scrollHeight;
      isInitialLoad.current = false;
    } else if (added && (nearBottom || autoStick)) {
      // New items: smooth scroll only if we're near bottom or autoStick is on
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }

    prevCountRef.current = itemCount;
  }, [itemCount, autoStick, threshold, containerRef, bottomRef]);

  // Attach to onScroll of the container
  const onScroll: React.UIEventHandler<HTMLElement> = (e) => {
    const el = e.currentTarget;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

    setShowJump(!nearBottom);
    setAutoStick(nearBottom); // stop sticking when user scrolls up; resume when back down
  };

  const jumpToLatest = () => {
    setAutoStick(true);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  return { onScroll, showJump, jumpToLatest, setAutoStick };
}