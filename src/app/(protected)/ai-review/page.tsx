import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentUserActiveDealRole } from '@/utils/roles'

export default async function AIReviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // Stage 7C: only lead_advisor can access AI review
  const roleName = await getCurrentUserActiveDealRole(user.id)
  if (roleName === 'advisor' || roleName === 'viewer') {
    return redirect('/dashboard')
  }

  // Get active deal
  const { data: deals } = await supabase.from('deals').select('id').limit(1)
  const activeDealId = deals?.[0]?.id

  let outputs: any[] = []
  if (activeDealId) {
    // Fetch pending AI outputs
    const { data } = await supabase
      .from('ai_outputs')
      .select('*, ai_jobs(*)')
      .eq('deal_id', activeDealId)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false })
    outputs = data || []
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Очередь проверки ИИ</h1>
          <p className="text-gray-500">Чек-лист черновиков, ожидающих утверждения человеком.</p>
        </div>
      </div>

      <div className="bg-white border rounded-lg shadow-sm">
        {outputs.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {outputs.map((output) => (
              <div key={output.id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col gap-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 self-start">
                      {output.ai_jobs?.action_type === 'document_summarization' ? 'Резюме документа' : 
                       output.ai_jobs?.action_type === 'email_drafting' ? 'Черновик письма' : 'Генерация'}
                    </span>
                    <span className="text-sm text-gray-400 mt-1">
                      Создано: {new Date(output.created_at).toLocaleString('ru-RU')}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-md mb-4 text-gray-800 whitespace-pre-wrap border">
                  {output.generated_text}
                </div>

                <div className="flex gap-3 justify-end mt-4">
                  <button disabled className="px-4 py-2 border rounded-md text-gray-700 bg-white hover:bg-gray-50 opacity-50 font-medium">
                    Отклонить
                  </button>
                  <button disabled className="px-4 py-2 rounded-md text-white bg-green-600 hover:bg-green-700 opacity-50 font-medium">
                    Одобрить
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>Новых черновиков нет. Вы проверили все сгенерированные тексты.</p>
          </div>
        )}
      </div>
    </div>
  )
}
