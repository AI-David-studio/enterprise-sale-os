import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import { ExternalDownloadButton } from './external-download-button'

export default async function ExternalPortalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  const admin = createAdminClient()

  // --- Resolve external access grants for this user ---
  const { data: accessRows, error: accessError } = await admin
    .from('external_access')
    .select('id, deal_id')
    .eq('user_id', user.id)
    .is('revoked_at', null)

  if (accessError) {
    console.error('ExternalPortalPage: external_access lookup failed', accessError)
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-red-800 mb-2">Ошибка</h1>
          <p className="text-red-700">Не удалось загрузить данные доступа. Попробуйте позже.</p>
        </div>
      </div>
    )
  }

  const grants = accessRows || []

  // --- 0 grants: access denied ---
  if (grants.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="bg-gray-50 border rounded-lg p-6 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">Нет активного доступа</h1>
          <p className="text-gray-600">У вас нет активного внешнего доступа к документам. Обратитесь к отправителю приглашения.</p>
        </div>
      </div>
    )
  }

  // --- >1 grants: blocked (single-deal MVP) ---
  if (grants.length > 1) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-yellow-800 mb-2">Множественный доступ</h1>
          <p className="text-yellow-700">
            Этот внешний портал пока поддерживает только один активный доступ на аккаунт.
            Обратитесь к администратору для уточнения.
          </p>
        </div>
      </div>
    )
  }

  // --- Exactly 1 grant: proceed ---
  const grant = grants[0]

  // Fetch only externally allowlisted documents for this deal
  const { data: documents, error: docsError } = await admin
    .from('documents')
    .select('id, name, category, created_at')
    .eq('deal_id', grant.deal_id)
    .eq('is_external', true)
    .order('created_at', { ascending: false })

  if (docsError) {
    console.error('ExternalPortalPage: documents query failed', docsError)
  }

  const docs = documents || []

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Документы сделки</h1>
        <p className="text-gray-500">Доступные документы для внешнего просмотра.</p>
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
            {docs.map((doc) => (
              <tr key={doc.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  {doc.name}
                </td>
                <td className="px-6 py-4 text-gray-500">{doc.category || 'Без категории'}</td>
                <td className="px-6 py-4 text-gray-500">{new Date(doc.created_at).toLocaleDateString('ru-RU')}</td>
                <td className="px-6 py-4 text-sm">
                  <ExternalDownloadButton documentId={doc.id} />
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                    <p>Документы для внешнего просмотра ещё не добавлены.</p>
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
