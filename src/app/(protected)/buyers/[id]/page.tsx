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
      
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-500 mb-2 font-medium">Модуль истории коммуникаций (Отложено)</p>
        <p className="text-sm text-gray-400">Данный блок будет реализован на Этапе 3.</p>
      </div>
    </div>
  )
}
