import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function CommunicationsPage() {
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

  let communications: any[] = []
  if (activeDealId) {
    // Get all communications for buyers in this deal
    const { data } = await supabase
      .from('communications')
      .select('*, buyers!inner(name)')
      .eq('buyers.deal_id', activeDealId)
      .order('date', { ascending: false })
    communications = data || []
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">История коммуникаций</h1>
          <p className="text-gray-500">Централизованный лог взаимодействия с покупателями.</p>
        </div>
        <button disabled className="bg-blue-600 opacity-50 text-white px-4 py-2 rounded-md font-medium">
          + Добавить запись
        </button>
      </div>

      <div className="bg-white border rounded-lg shadow-sm">
        {communications.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {communications.map((comm) => (
              <div key={comm.id} className="p-6 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {comm.type}
                    </span>
                    <span className="font-medium text-gray-900">{comm.buyers?.name}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(comm.date).toLocaleString('ru-RU')}
                  </span>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap mt-2">{comm.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
            <p>Нет записей коммуникаций. Добавьте первую запись после контакта с покупателем.</p>
          </div>
        )}
      </div>
    </div>
  )
}
