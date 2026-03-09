import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function BuyerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  const { data: buyer } = await supabase
    .from('buyers')
    .select(`
      *,
      buyer_pipeline_states(
        pipeline_stages(name)
      )
    `)
    .eq('id', id)
    .single()

  if (!buyer) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Покупатель не найден</h2>
        <Link href="/buyers" className="text-blue-600 hover:underline">Вернуться к списку</Link>
      </div>
    )
  }

  const currentStageName = buyer.buyer_pipeline_states?.[0]?.pipeline_stages?.name || 'Нет этапа'

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-6">
        <Link href="/buyers" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
          &larr; Назад к покупателям
        </Link>
      </div>

      <div className="bg-white border rounded-lg shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-5 border-b flex justify-between items-center bg-gray-50">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{buyer.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{buyer.industry} • {buyer.website}</p>
          </div>
          <div className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
            Текущий этап: {currentStageName}
          </div>
        </div>
        
        <div className="p-6">
          <h2 className="text-base font-medium text-gray-900 mb-4">Описание профиля</h2>
          <p className="text-gray-700 whitespace-pre-line">{buyer.description || 'Описание отсутствует.'}</p>
        </div>
      </div>
      
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center flex flex-col items-center gap-4">
        <div>
          <p className="text-gray-500 mb-2 font-medium">История коммуникаций</p>
          <Link href="/communications" className="text-sm text-blue-600 hover:underline">
            Перейти в центральный лог коммуникаций
          </Link>
        </div>
        
        <form action={async () => {
          'use server'
          const { requestAIEmailDraft } = await import('@/actions/ai')
          await requestAIEmailDraft(buyer.deal_id, buyer.id)
        }}>
          <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded-md font-medium hover:bg-purple-700 transition-colors shadow-sm inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Черновик письма
          </button>
        </form>
      </div>
    </div>
  )
}
