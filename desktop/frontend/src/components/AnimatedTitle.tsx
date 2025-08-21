import React, { useState, useEffect } from 'react';

interface AnimatedTitleProps {
  title: string;
  isAnimating: boolean;
  className?: string;
}

export const AnimatedTitle: React.FC<AnimatedTitleProps> = ({
  title,
  isAnimating,
  className = '',
}) => {
  const [displayedTitle, setDisplayedTitle] = useState('');
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    if (!isAnimating) {
      setDisplayedTitle(title);
      setShowCursor(false);
      return;
    }

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
      setDisplayedTitle(title);
      setShowCursor(false);
      return;
    }

    setDisplayedTitle('');
    setShowCursor(true);

    const typewriterDelay = 50; // milliseconds between characters
    let currentIndex = 0;

    const typeInterval = setInterval(() => {
      if (currentIndex <= title.length) {
        setDisplayedTitle(title.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typeInterval);
        setShowCursor(false);
      }
    }, typewriterDelay);

    return () => {
      clearInterval(typeInterval);
      setShowCursor(false);
    };
  }, [title, isAnimating]);

  // Cursor blinking effect
  useEffect(() => {
    if (!showCursor) return;

    const blinkInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);

    return () => clearInterval(blinkInterval);
  }, [showCursor]);

  return (
    <span
      className={className}
      aria-live="polite"
      aria-label={isAnimating ? `Generating title: ${displayedTitle}` : title}
    >
      {displayedTitle}
      {showCursor && (
        <span className="animate-pulse" aria-hidden="true">
          |
        </span>
      )}
    </span>
  );
};