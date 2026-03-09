import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // Get active deal
  const { data: deals } = await supabase.from('deals').select('id').limit(1)
  const activeDealId = deals?.[0]?.id

  // Fetch documents
  let documents: any[] = []
  if (activeDealId) {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('deal_id', activeDealId)
      .order('created_at', { ascending: false })
    documents = data || []
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Документы</h1>
          <p className="text-gray-500">Защищенное хранилище файлов (Vault) для текущей сделки.</p>
        </div>
        <button disabled className="bg-blue-600 opacity-50 text-white px-4 py-2 rounded-md font-medium">
          + Загрузить файл
        </button>
      </div>

      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Название файла</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Категория</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Дата загрузки</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  {doc.name}
                </td>
                <td className="px-6 py-4 text-gray-500">{doc.category || 'Без категории'}</td>
                <td className="px-6 py-4 text-gray-500">{new Date(doc.created_at).toLocaleDateString('ru-RU')}</td>
                <td className="px-6 py-4 text-sm flex gap-3">
                  <button disabled className="font-medium text-indigo-600 hover:text-indigo-900 opacity-50 cursor-not-allowed">
                    Скачать
                  </button>
                  <form action={async () => {
                    'use server'
                    const { requestAISummarization } = await import('@/actions/ai')
                    await requestAISummarization(doc.deal_id, doc.id)
                  }}>
                    <button type="submit" className="font-medium text-purple-600 hover:text-purple-900">
                      Сгенерировать резюме
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                    <p>Нет файлов в хранилище. Нажмите «Загрузить файл», чтобы добавить документы.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
