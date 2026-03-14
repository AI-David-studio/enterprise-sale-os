'use client'

import { useState, useRef, useEffect } from 'react'
import { useActionState } from 'react'
import { createBuyerAction, type BuyerActionResult } from '@/actions/buyer'
import toast from 'react-hot-toast'

const initialState: BuyerActionResult = { success: false }

export function CreateBuyerForm() {
  const [isOpen, setIsOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, isPending] = useActionState(
    async (_prev: BuyerActionResult, formData: FormData) => {
      const result = await createBuyerAction(formData)
      if (result.success) {
        setIsOpen(false)
      }
      return result
    },
    initialState
  )

  useEffect(() => {
    if (state.success) {
      toast.success('Покупатель успешно создан')
      formRef.current?.reset()
      // state.success doesn't intrinsically clear the error field in React 19 useActionState unless returned clean,
      // but this matches the contract.
    }
  }, [state.success])

  const handleClose = () => {
    if (!isPending) {
      setIsOpen(false)
      formRef.current?.reset()
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors"
      >
        + Добавить покупателя
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Новый покупатель</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            disabled={isPending}
          >
            ×
          </button>
        </div>

        <form ref={formRef} action={formAction} className="p-6 space-y-4">
          <div>
            <label htmlFor="buyer-name" className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
            <input
              id="buyer-name"
              name="name"
              type="text"
              required
              className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="ООО «Инвесткор»"
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor="buyer-industry" className="block text-sm font-medium text-gray-700 mb-1">Индустрия</label>
            <input
              id="buyer-industry"
              name="industry"
              type="text"
              className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Финансовый сектор"
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor="buyer-website" className="block text-sm font-medium text-gray-700 mb-1">Веб-сайт</label>
            <input
              id="buyer-website"
              name="website"
              type="text"
              className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://example.com"
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor="buyer-description" className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea
              id="buyer-description"
              name="description"
              className="w-full border rounded-md px-3 py-2 h-20 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Краткое описание покупателя..."
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
              onClick={handleClose}
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
              {isPending ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
