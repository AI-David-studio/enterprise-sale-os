'use client'

import { useActionState, useEffect } from 'react'
import { toggleTaskStatusAction, type TaskActionResult } from '@/actions/task'
import toast from 'react-hot-toast'

const initialState: TaskActionResult = { success: false }

export function TaskStatusToggle({
  taskId,
  currentStatus,
}: {
  taskId: string
  currentStatus: string
}) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: TaskActionResult, formData: FormData) => {
      return await toggleTaskStatusAction(formData)
    },
    initialState
  )

  useEffect(() => {
    if (state.success) {
      toast.success('Статус задачи обновлен')
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state])

  const isCompleted = currentStatus === 'completed'

  return (
    <form action={formAction} className="inline flex-shrink-0 mt-0.5">
      <input type="hidden" name="task_id" value={taskId} />
      <button
        type="submit"
        disabled={isPending}
        title={isCompleted ? 'Вернуть в ожидающие' : 'Отметить выполненной'}
        className={`h-5 w-5 rounded border flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          isCompleted
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'border-gray-300 bg-white hover:border-blue-400'
        }`}
        aria-label={isCompleted ? 'Вернуть в ожидающие' : 'Отметить выполненной'}
      >
        {isCompleted && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
    </form>
  )
}
