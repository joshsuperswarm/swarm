import { cn } from '../lib/cn'

type Mode = 'fast' | 'thinking'

export default function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: Mode
  onChange: (m: Mode) => void
  disabled?: boolean
}) {
  const btn = (value: Mode, label: string) => {
    const active = mode === value
    const title =
      value === 'fast'
        ? 'Fast (reasoning_effort=minimal). Shift+Tab to toggle.'
        : 'Thinking (reasoning_effort=high). Shift+Tab to toggle.'
    return (
      <button
        type="button"
        onClick={() => onChange(value)}
        disabled={disabled}
        aria-pressed={active}
        title={title}
        className={cn(
          'px-2 h-8 text-xs rounded-md border transition-colors',
          active
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
          disabled && 'opacity-60 cursor-not-allowed'
        )}
      >
        {label}
      </button>
    )
  }

  return (
    <div
      role="group"
      aria-label="Model mode"
      className="ml-1 mr-0 inline-flex gap-1"
    >
      {btn('fast', 'Fast')}
      {btn('thinking', 'Thinking')}
    </div>
  )
}