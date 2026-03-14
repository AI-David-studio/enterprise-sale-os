'use client'

import { useActionState, useEffect } from 'react'
import { moveBuyerStageAction, type BuyerActionResult } from '@/actions/buyer'
import toast from 'react-hot-toast'

const initialState: BuyerActionResult = { success: false }

export function PipelineStageSelector({
  buyerId,
  currentStageId,
  stages,
}: {
  buyerId: string
  currentStageId: string | null
  stages: { id: string; name: string }[]
}) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: BuyerActionResult, formData: FormData) => {
      return await moveBuyerStageAction(formData)
    },
    initialState
  )

  useEffect(() => {
    if (state.success) {
      toast.success('Этап обновлён')
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <form action={formAction}>
      <input type="hidden" name="buyer_id" value={buyerId} />
      <div className="flex items-center gap-4">
        <label htmlFor="stage-select" className="text-sm font-medium text-gray-700 whitespace-nowrap">
          Перевести на этап:
        </label>
        <select
          id="stage-select"
          name="new_stage_id"
          defaultValue={currentStageId || ''}
          disabled={isPending}
          className="border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex-1 disabled:opacity-50"
        >
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isPending ? 'Сохранение...' : 'Применить'}
        </button>
      </div>
    </form>
  )
}
