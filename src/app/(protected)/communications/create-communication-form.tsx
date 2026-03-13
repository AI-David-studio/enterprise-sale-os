'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { createCommunicationAction, type CommunicationActionResult } from '@/actions/communication'

const initialState: CommunicationActionResult = { success: false }

export function CreateCommunicationForm({
  buyers,
}: {
  buyers: { id: string; name: string }[]
}) {
  const [isOpen, setIsOpen] = useState(false)

  const [state, formAction, isPending] = useActionState(
    async (_prev: CommunicationActionResult, formData: FormData) => {
      const result = await createCommunicationAction(formData)
      if (result.success) {
        setIsOpen(false)
      }
      return result
    },
    initialState
  )

  // Default datetime-local value: current local time formatted as YYYY-MM-DDTHH:MM
  const now = new Date()
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors"
      >
        + Добавить запись
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Новая запись коммуникации</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            disabled={isPending}
          >
            ×
          </button>
        </div>

        <form action={formAction} className="p-6 space-y-4">
          <div>
            <label htmlFor="comm-buyer" className="block text-sm font-medium text-gray-700 mb-1">Покупатель *</label>
            <select
              id="comm-buyer"
              name="buyer_id"
              required
              className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isPending}
            >
              <option value="">Выберите покупателя</option>
              {buyers.map((buyer) => (
                <option key={buyer.id} value={buyer.id}>
                  {buyer.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="comm-type" className="block text-sm font-medium text-gray-700 mb-1">Тип *</label>
            <select
              id="comm-type"
              name="type"
              required
              className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isPending}
            >
              <option value="Email">Email</option>
              <option value="Call">Call</option>
              <option value="Meeting">Meeting</option>
              <option value="Note">Note</option>
            </select>
          </div>

          <div>
            <label htmlFor="comm-date" className="block text-sm font-medium text-gray-700 mb-1">Дата и время *</label>
            <input
              id="comm-date"
              name="date"
              type="datetime-local"
              required
              defaultValue={defaultDate}
              className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor="comm-content" className="block text-sm font-medium text-gray-700 mb-1">Содержание *</label>
            <textarea
              id="comm-content"
              name="content"
              required
              className="w-full border rounded-md px-3 py-2 h-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Описание контакта с покупателем..."
              disabled={isPending}
            />
          </div>

          {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {state.error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
              className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
