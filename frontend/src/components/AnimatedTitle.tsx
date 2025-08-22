import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { ThreeDotsAnimation } from "@/components/ThreeDotsAnimation"

interface AnimatedTitleProps {
  title: string
  pending: boolean
  status?: string | null
  className?: string
  ariaLabelPending?: string
}

export function AnimatedTitle({
  title,
  pending,
  status,
  className,
  ariaLabelPending = "Generating title…",
}: AnimatedTitleProps) {
  const prefersReduce = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    []
  )
  const [displayed, setDisplayed] = useState<string>("")
  const [shouldAnimate, setShouldAnimate] = useState<boolean>(false)
  const typingRef = useRef<number | null>(null)
  const prevStateRef = useRef<{ title: string; pending: boolean }>({ title, pending })
  const wasEverEmptyRef = useRef<boolean>(!title.trim() || pending)

  // Detect when we should animate (for tasks that were ever empty, excluding failed tasks)
  useEffect(() => {
    const prevState = prevStateRef.current
    const titleChanged = prevState.title !== title
    const isNowResolved = !pending && title.trim()
    const isFailed = status === 'failed'
    
    // Track if task was ever empty
    if (pending || !title.trim()) {
      wasEverEmptyRef.current = true
    }
    
    // Only animate if: task was ever empty, title changed to resolved state, and not failed
    if (wasEverEmptyRef.current && titleChanged && isNowResolved && !isFailed) {
      setShouldAnimate(true)
    } else {
      setShouldAnimate(false)
    }
    
    prevStateRef.current = { title, pending }
  }, [title, pending, status])

  // Reset when title changes or returns to pending
  useEffect(() => {
    if (pending) {
      if (typingRef.current) cancelAnimationFrame(typingRef.current)
      setDisplayed("")
    }
  }, [pending, title])

  // Typewriter on resolve
  useEffect(() => {
    if (pending) return
    
    // If we shouldn't animate or user prefers reduced motion, show immediately
    if (!shouldAnimate || prefersReduce) {
      setDisplayed(title)
      return
    }

    setDisplayed("")
    const chars = [...title]
    let i = 0
    const startTime = performance.now()
    
    const step = (currentTime: number) => {
      // More consistent timing for mobile - aim for ~60fps with adaptive speed
      const elapsed = currentTime - startTime
      const targetDuration = Math.min(title.length * 30, 2000) // 30ms per char, max 2s
      const progress = elapsed / targetDuration
      
      // Calculate how many characters should be shown
      const targetIndex = Math.floor(progress * chars.length)
      i = Math.min(targetIndex, chars.length)
      
      setDisplayed(chars.slice(0, i).join(""))
      
      if (i < chars.length && elapsed < targetDuration) {
        typingRef.current = requestAnimationFrame(step)
      } else {
        // Ensure we show the complete title
        setDisplayed(title)
        typingRef.current = null
      }
    }
    typingRef.current = requestAnimationFrame(step)
    
    return () => {
      if (typingRef.current) cancelAnimationFrame(typingRef.current)
    }
  }, [pending, title, shouldAnimate, prefersReduce])

  if (pending) {
    return (
      <div
        className={cn("inline-flex items-center text-linear-text-muted", className)}
        aria-live="polite"
        aria-busy="true"
        aria-label={ariaLabelPending}
      >
        <span>Generating title</span>
        <ThreeDotsAnimation className="ml-1" />
        <span className="ml-1 blink">▌</span>
      </div>
    )
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      <span className="whitespace-pre-wrap">{displayed}</span>
      <AnimatePresence>
        {shouldAnimate && displayed !== title && (
          <motion.span
            className="blink"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            ▌
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}