'use client'

import { useActionState, useEffect } from 'react'
import { updateDealAction, type DealActionResult } from '@/actions/deal'
import toast from 'react-hot-toast'

const initialState: DealActionResult = { success: false }

export function DealSettingsForm({
  deal,
  canEdit,
}: {
  deal: { id: string; name: string; description: string | null; target_industry: string | null }
  canEdit: boolean
}) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: DealActionResult, formData: FormData) => {
      return await updateDealAction(formData)
    },
    initialState
  )

  useEffect(() => {
    if (state.success) {
      toast.success('Настройки проекта обновлены')
    }
  }, [state.success])

  return (
    <form action={formAction} className="space-y-6 bg-white p-6 rounded-lg border shadow-sm">
      <div>
        <label htmlFor="deal-name" className="block text-sm font-medium text-gray-700 mb-1">Название проекта (Кодовое имя)</label>
        <input
          id="deal-name"
          name="name"
          type="text"
          className="w-full border rounded-md px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          defaultValue={deal.name || ''}
          placeholder="Проект Альфа"
          disabled={!canEdit || isPending}
        />
      </div>

      <div>
        <label htmlFor="deal-description" className="block text-sm font-medium text-gray-700 mb-1">Описание / Статус</label>
        <textarea
          id="deal-description"
          name="description"
          className="w-full border rounded-md px-4 py-2 h-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          defaultValue={deal.description || ''}
          placeholder="Конфиденциальная продажа актива..."
          disabled={!canEdit || isPending}
        />
      </div>

      <div>
        <label htmlFor="deal-industry" className="block text-sm font-medium text-gray-700 mb-1">Индустрия цели</label>
        <input
          id="deal-industry"
          name="target_industry"
          type="text"
          className="w-full border rounded-md px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          defaultValue={deal.target_industry || ''}
          placeholder="SaaS / Technology"
          disabled={!canEdit || isPending}
        />
      </div>

      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
          Изменения сохранены.
        </div>
      )}

      <div className="pt-4 border-t">
        {canEdit ? (
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-600 text-white font-medium px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Сохраняется...' : 'Сохранить изменения'}
          </button>
        ) : (
          <p className="text-sm text-gray-400">Редактирование доступно только Lead Advisor.</p>
        )}
      </div>
    </form>
  )
}
