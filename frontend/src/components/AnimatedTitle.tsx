import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface AnimatedTitleProps {
  title: string
  pending: boolean
  className?: string
  ariaLabelPending?: string
}

export function AnimatedTitle({
  title,
  pending,
  className,
  ariaLabelPending = "Generating title…",
}: AnimatedTitleProps) {
  const prefersReduce = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    []
  )
  const [displayed, setDisplayed] = useState<string>("")
  const typingRef = useRef<number | null>(null)

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
    if (prefersReduce) {
      setDisplayed(title)
      return
    }

    setDisplayed("")
    const chars = [...title]
    let i = 0
    const step = () => {
      i += Math.random() < 0.5 ? 1 : 2 // 1–2 chars per frame-ish
      setDisplayed(chars.slice(0, i).join(""))
      if (i < chars.length) {
        typingRef.current = requestAnimationFrame(step)
      } else {
        typingRef.current = null
      }
    }
    typingRef.current = requestAnimationFrame(step)
    return () => {
      if (typingRef.current) cancelAnimationFrame(typingRef.current)
    }
  }, [pending, title, prefersReduce])

  if (pending) {
    return (
      <div
        className={cn("inline-flex items-center text-linear-text-muted", className)}
        aria-live="polite"
        aria-busy="true"
        aria-label={ariaLabelPending}
      >
        <span>Generating title</span>
        <motion.span
          className="ml-1 inline-flex"
          initial="start"
          animate="pulse"
          variants={{ pulse: { transition: { staggerChildren: 0.12, repeat: Infinity } } }}
        >
          {[0,1,2].map(i => (
            <motion.span
              key={i}
              className="mx-[1px]"
              variants={{ start: { y: 0, opacity: 0.4 }, pulse: { y: [0, -2, 0], opacity: [0.4, 1, 0.4] } }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
            >
              ·
            </motion.span>
          ))}
        </motion.span>
        <span className="ml-1 blink">▌</span>
      </div>
    )
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      <span className="whitespace-pre-wrap">{displayed}</span>
      <AnimatePresence>
        {displayed !== title && (
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