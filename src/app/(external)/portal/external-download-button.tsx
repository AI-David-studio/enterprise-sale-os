'use client'

import { useActionState } from 'react'
import { getExternalDocumentDownloadUrlAction, type ExternalDocumentActionResult } from '@/actions/external-document'

const initialState: ExternalDocumentActionResult = { success: false }

export function ExternalDownloadButton({ documentId }: { documentId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: ExternalDocumentActionResult, formData: FormData) => {
      const result = await getExternalDocumentDownloadUrlAction(formData)
      if (result.success && result.url) {
        window.location.assign(result.url)
      }
      return result
    },
    initialState
  )

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="document_id" value={documentId} />
      <button
        type="submit"
        disabled={isPending}
        className="font-medium text-indigo-600 hover:text-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Загрузка...' : 'Скачать'}
      </button>
      {state.error && (
        <span className="text-xs text-red-500 ml-2">{state.error}</span>
      )}
    </form>
  )
}
