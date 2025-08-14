import { AlertCircle } from 'lucide-react'
import { useRepoStore } from '../store/useRepoStore'
import { cn } from '../lib/cn'

export default function TokenCountBadge() {
  const { tokenReport } = useRepoStore()

  if (!tokenReport || tokenReport.total_tokens === 0) {
    return null
  }

  const percentage = (tokenReport.total_tokens / tokenReport.model_context_window) * 100
  const isWarning = tokenReport.may_exceed_context

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
        isWarning
          ? "bg-amber-100 text-amber-800"
          : "bg-gray-100 text-gray-700"
      )}
    >
      {isWarning && <AlertCircle className="h-4 w-4" />}
      <span>
        {tokenReport.total_tokens.toLocaleString()} / {tokenReport.model_context_window.toLocaleString()}
      </span>
      <span className="text-xs opacity-75">
        ({percentage.toFixed(0)}%)
      </span>
    </div>
  )
}