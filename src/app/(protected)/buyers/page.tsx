import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function BuyersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // Get active deal
  const { data: deals } = await supabase
    .from('deals')
    .select('id')
    .limit(1)

  const activeDealId = deals?.[0]?.id

  let buyers: any[] = []
  if (activeDealId) {
    const { data } = await supabase
      .from('buyers')
      .select('id, name, industry, website, buyer_pipeline_states(stage_id)')
      .eq('deal_id', activeDealId)
      .order('created_at', { ascending: false })
    buyers = data || []
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Покупатели</h1>
          <p className="text-gray-500">Каталог контрагентов, заинтересованных в сделке.</p>
        </div>
        <button disabled className="bg-blue-600 opacity-50 text-white px-4 py-2 rounded-md font-medium">
          + Добавить покупателя
        </button>
      </div>

      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Индустрия</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Веб-сайт</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {buyers.map((buyer) => (
              <tr key={buyer.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{buyer.name}</td>
                <td className="px-6 py-4 text-gray-500">{buyer.industry}</td>
                <td className="px-6 py-4 text-blue-600 hover:underline">
                  {buyer.website && <a href={buyer.website} target="_blank" rel="noreferrer">{buyer.website}</a>}
                </td>
                <td className="px-6 py-4 text-sm">
                  <Link href={`/buyers/${buyer.id}`} className="font-medium text-indigo-600 hover:text-indigo-900">
                    Открыть карточку
                  </Link>
                </td>
              </tr>
            ))}
            {buyers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  Нет активных покупателей. Нажмите «Добавить покупателя», чтобы начать работу.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
