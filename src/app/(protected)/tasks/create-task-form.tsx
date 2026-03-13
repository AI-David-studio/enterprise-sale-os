'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { createTaskAction, type TaskActionResult } from '@/actions/task'

const initialState: TaskActionResult = { success: false }

export function CreateTaskForm() {
  const [isOpen, setIsOpen] = useState(false)

  const [state, formAction, isPending] = useActionState(
    async (_prev: TaskActionResult, formData: FormData) => {
      const result = await createTaskAction(formData)
      if (result.success) {
        setIsOpen(false)
      }
      return result
    },
    initialState
  )

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors"
      >
        + Добавить задачу
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Новая задача</h2>
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
            <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
            <input
              id="task-title"
              name="title"
              type="text"
              required
              className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Подготовить CIM для покупателя"
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor="task-description" className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea
              id="task-description"
              name="description"
              className="w-full border rounded-md px-3 py-2 h-20 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Дополнительные детали задачи..."
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
              {isPending ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
