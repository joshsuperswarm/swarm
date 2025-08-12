import { useEffect } from 'react';

export function useTaskHotkeys(
  tasksLength: number,
  selectedIndex: number,
  setSelectedIndex: (i: number) => void,
  onArchive?: () => void
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't interfere with input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'j') {
        e.preventDefault();
        setSelectedIndex(Math.min(selectedIndex + 1, tasksLength - 1));
      }
      
      if (e.key === 'k') {
        e.preventDefault();
        setSelectedIndex(Math.max(selectedIndex - 1, 0));
      }

      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        onArchive?.();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tasksLength, selectedIndex, setSelectedIndex, onArchive]);
}