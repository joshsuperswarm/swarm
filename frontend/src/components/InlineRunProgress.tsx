import { Loader2 } from 'lucide-react'
import { CollapsedTodoList } from '@/components/CollapsedTodoList'
import { ThreeDotsAnimation } from '@/components/ThreeDotsAnimation'
import type { AgentTodo } from '@/types/generated/AgentTodo'

type Phase = 'spinning' | 'running' | null

type Props = {
  phase: Phase
  todos: AgentTodo[]
  isLoadingTodos: boolean
  className?: string
}

export function InlineRunProgress({
  phase,
  todos,
  isLoadingTodos,
  className,
}: Props) {
  if (!phase) return null

  const Row = ({
    icon,
    label,
  }: {
    icon: 'loader' | 'bot'
    label: string
  }) => (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      {icon === 'loader' ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <ThreeDotsAnimation />
      )}
      <span>{label}</span>
      {isLoadingTodos && (
        <div className="w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      )}
    </div>
  )

  return (
    <div className={className}>
      {phase === 'spinning' && (
        <Row icon="loader" label="Modal sandbox spinning up…" />
      )}
      {phase === 'running' && (
        <>
          <Row icon="bot" label="Claude is working on this task" />
          {todos.length > 0 && (
            <div className="mt-2">
              <CollapsedTodoList todos={todos} />
            </div>
          )}
        </>
      )}
    </div>
  )
}