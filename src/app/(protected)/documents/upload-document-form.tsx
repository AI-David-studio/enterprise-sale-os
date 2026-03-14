'use client'

import { useState, useRef, useEffect } from 'react'
import { useActionState } from 'react'
import { uploadDocumentAction, type DocumentActionResult } from '@/actions/document'
import toast from 'react-hot-toast'

const initialState: DocumentActionResult = { success: false }

export function UploadDocumentForm() {
  const [isOpen, setIsOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, isPending] = useActionState(
    async (_prev: DocumentActionResult, formData: FormData) => {
      const result = await uploadDocumentAction(formData)
      if (result.success) {
        setIsOpen(false)
      }
      return result
    },
    initialState
  )

  useEffect(() => {
    if (state.success) {
      toast.success('Документ успешно загружен')
      formRef.current?.reset()
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
        + Загрузить файл
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Загрузить документ</h2>
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
            <label htmlFor="doc-file" className="block text-sm font-medium text-gray-700 mb-1">Файл *</label>
            <input
              id="doc-file"
              name="file"
              type="file"
              required
              className="w-full border rounded-md px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor="doc-name" className="block text-sm font-medium text-gray-700 mb-1">
              Название <span className="text-gray-400">(по умолчанию — имя файла)</span>
            </label>
            <input
              id="doc-name"
              name="name"
              type="text"
              className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Опционально"
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor="doc-category" className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
            <select
              id="doc-category"
              name="category"
              className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isPending}
            >
              <option value="">Без категории</option>
              <option value="Financial">Financial</option>
              <option value="Legal">Legal</option>
              <option value="Technical">Technical</option>
              <option value="Other">Other</option>
            </select>
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
              {isPending ? 'Загрузка...' : 'Загрузить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
