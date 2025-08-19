import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type AgentThinkingIndicatorProps = {
  phase: "spinning" | "running";
  className?: string;
};

export function AgentThinkingIndicator({ phase, className }: AgentThinkingIndicatorProps) {
  const label = phase === "spinning" ? "Modal sandbox spinning up…" : "Agent is running…";

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={phase}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.15 }}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs shadow-sm",
          className
        )}
        aria-live="polite"
      >
        {phase === "spinning" ? (
          <motion.div
            className="relative"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          >
            <Loader2 className="h-4 w-4 text-gray-600" />
          </motion.div>
        ) : (
          <Zap className="h-4 w-4 text-blue-600" />
        )}
        <span>{label}</span>
      </motion.div>
    </AnimatePresence>
  );
}