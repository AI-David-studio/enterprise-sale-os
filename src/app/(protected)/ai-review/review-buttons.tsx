'use client'

import { useActionState, useEffect } from 'react'
import { approveAIOutputAction, discardAIOutputAction, type AIReviewActionResult } from '@/actions/ai'
import toast from 'react-hot-toast'

const initialState: AIReviewActionResult = { success: false }

export function ApproveAIButton({ outputId }: { outputId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: AIReviewActionResult, formData: FormData) => {
      return approveAIOutputAction(formData)
    },
    initialState
  )

  useEffect(() => {
    if (state.success) {
      toast.success('Элемент одобрен', { id: `approve-${outputId}` })
    } else if (state.error) {
      toast.error(state.error, { id: `approve-${outputId}-error` })
    }
  }, [state, outputId])

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="ai_output_id" value={outputId} />
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 rounded-md text-white bg-green-600 hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Обработка...' : 'Одобрить'}
      </button>
    </form>
  )
}

export function DiscardAIButton({ outputId }: { outputId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: AIReviewActionResult, formData: FormData) => {
      return discardAIOutputAction(formData)
    },
    initialState
  )

  useEffect(() => {
    if (state.success) {
      toast.success('Элемент отклонен', { id: `discard-${outputId}` })
    } else if (state.error) {
      toast.error(state.error, { id: `discard-${outputId}-error` })
    }
  }, [state, outputId])

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="ai_output_id" value={outputId} />
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 border rounded-md text-gray-700 bg-white hover:bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Обработка...' : 'Отклонить'}
      </button>
    </form>
  )
}
