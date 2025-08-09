export function isTitlePending({
  title,
  status,
  description,
}: {
  title?: string | null
  status?: string | null
  description?: string | null
}): boolean {
  const t = (title || "").trim()
  const s = (status || "").toLowerCase()
  const d = (description || "").trim()

  if (!t) return true
  if (/^(untitled|generating|pending)/i.test(t)) return true

  const looksLikeTruncatedDesc =
    !!d && t.length >= 10 && d.toLowerCase().startsWith(t.toLowerCase())
  if ((s === "spinning" || s === "running") && looksLikeTruncatedDesc) return true

  return false
}