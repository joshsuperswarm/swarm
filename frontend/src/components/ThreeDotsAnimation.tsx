import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ThreeDotsAnimationProps {
  className?: string
}

export function ThreeDotsAnimation({ className }: ThreeDotsAnimationProps) {
  return (
    <motion.span
      className={cn("inline-flex", className)}
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