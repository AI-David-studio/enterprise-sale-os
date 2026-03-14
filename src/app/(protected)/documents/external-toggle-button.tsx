'use client'

import { useActionState } from 'react'
import { toggleDocumentExternalAction, type DocumentActionResult } from '@/actions/document'

const initialState: DocumentActionResult = { success: false }

interface ExternalToggleButtonProps {
  documentId: string
  isExternal: boolean
}

export function ExternalToggleButton({ documentId, isExternal }: ExternalToggleButtonProps) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: DocumentActionResult) => {
      return await toggleDocumentExternalAction(documentId)
    },
    initialState
  )

  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={isPending}
        className={`font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
          isExternal
            ? 'text-orange-600 hover:text-orange-800'
            : 'text-green-600 hover:text-green-800'
        }`}
      >
        {isPending
          ? 'Обновление...'
          : isExternal
            ? 'Закрыть внешний доступ'
            : 'Открыть внешний доступ'}
      </button>
      {state.error && (
        <span className="text-xs text-red-500 ml-2">{state.error}</span>
      )}
    </form>
  )
}
