import { AlertCircle } from 'lucide-react'
import { useConversationsStore } from '../store/useConversationsStore'
import { useRepoStore } from '../store/useRepoStore'
import { cn } from '../lib/cn'

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  } else if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  }
  return count.toString()
}

export default function TokenCountBadge() {
  const { conversations, activeId } = useConversationsStore()
  const conv = conversations.find(c => c.id === activeId)

  // Conversation running total (after messages already sent)
  const convoReport = conv?.contextTokens || null

  // Pending selection (files/folders chosen but not yet sent)
  const {
    tokenReport: selectionReport,
    selectedFiles,
    selectedFolders,
  } = useRepoStore()

  const hasSelection =
    (selectedFiles?.length ?? 0) + (selectedFolders?.length ?? 0) > 0

  // If nothing to show yet, keep previous behavior
  if (!convoReport && !selectionReport) return null

  // Context window: prefer convo (same model), else fall back to selection.
  const windowTokens =
    convoReport?.model_context_window ??
    selectionReport?.model_context_window ??
    128_000

  // Base tokens from current conversation
  const base = convoReport?.total_tokens ?? 0

  // Tokens for pending files (repo_count_tokens already summed)
  const pending = hasSelection ? (selectionReport?.total_tokens ?? 0) : 0

  // Tiny overhead for wrappers: `--- Selected Files ---` + per-file headers.
  // Keep this conservative; adjust if you want to be stricter.
  const perFileOverhead = 12
  const headerOverhead = hasSelection ? 6 : 0
  const fileCount = selectionReport?.files?.length ?? 0
  const overhead = headerOverhead + fileCount * perFileOverhead

  // Predicted total for the next request (what will actually be sent)
  const predictedTotal = base + pending + overhead

  const isWarning = predictedTotal > Math.floor(windowTokens * 0.9)

  // Show a subtle indicator when prediction includes pending files
  const hasPrediction = hasSelection

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full " +
          "text-sm font-medium",
        isWarning
          ? "bg-amber-100 text-amber-800"
          : "bg-gray-100 text-gray-700"
      )}
      title={
        hasPrediction
          ? "Includes selected files pending send"
          : "Conversation context used so far"
      }
    >
      {isWarning && <AlertCircle className="h-4 w-4" />}
      <span>
        {formatTokenCount(predictedTotal)} /{" "}
        {formatTokenCount(windowTokens)}
      </span>
    </div>
  )
}