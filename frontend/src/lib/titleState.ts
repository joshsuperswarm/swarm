export function isTitlePending({
  title,
  status,        // kept for signature compatibility
  description,   // kept for signature compatibility
}: {
  title?: string | null
  status?: string | null
  description?: string | null
}): boolean {
  const t = (title || "").trim()

  if (!t) return true
  if (/^(untitled|generating|pending)/i.test(t)) return true

  // No truncated-description logic at all
  return false
}