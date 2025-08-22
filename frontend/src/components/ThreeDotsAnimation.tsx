import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useMemo } from "react"

interface ThreeDotsAnimationProps {
  className?: string
}

export function ThreeDotsAnimation({ className }: ThreeDotsAnimationProps) {
  const prefersReducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    []
  )

  if (prefersReducedMotion) {
    // Simple static dots for reduced motion preference
    return (
      <span className={cn("inline-flex three-dots-static", className)}>
        <span className="mx-[1px] opacity-60">·</span>
        <span className="mx-[1px] opacity-80">·</span>
        <span className="mx-[1px] opacity-100">·</span>
      </span>
    )
  }

  return (
    <motion.span
      className={cn("inline-flex three-dots-animation", className)}
      initial="start"
      animate="pulse"
      variants={{ pulse: { transition: { staggerChildren: 0.12, repeat: Infinity } } }}
    >
      {[0, 1, 2].map(i => (
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
  )
}