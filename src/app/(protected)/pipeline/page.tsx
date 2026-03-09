import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function PipelinePage() {
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

  // Fetch canonical stages
  const { data: canonicalStages } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('deal_id', activeDealId)
    .order('sort_order', { ascending: true })

  // Fetch buyers
  const { data: buyersData } = await supabase
    .from('buyers')
    .select(`
      id, name,
      buyer_pipeline_states ( stage_id )
    `)
    .eq('deal_id', activeDealId)

  // Map buyers to stages
  const stages = canonicalStages || []
  const buyers = buyersData || []

  const boardMap = stages.map(stage => {
    return {
      ...stage,
      buyers: buyers.filter(b => b.buyer_pipeline_states?.[0]?.stage_id === stage.id)
    }
  })

  // Stages that don't exist yet but represent the canonical flow
  const placeholderStages = [
    'Preparation', 'Teaser', 'NDA', 'CIM', 'Meetings', 'LOI/IOI', 'Internal DD Tracking', 'Closing'
  ]

  return (
    <div className="h-full flex flex-col pt-4 pb-8 px-2 max-w-full overflow-hidden">
      <div className="mb-6 px-4 shrink-0">
        <h1 className="text-3xl font-bold mb-2">Воронка сделки</h1>
        <p className="text-gray-500">Канбан-доска для отслеживания прогресса коммуникации с покупателями.</p>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 px-4 flex gap-4 snap-x">
        {(stages.length > 0 ? boardMap : placeholderStages.map(m => ({ id: m, name: m, buyers: [] }))).map((stage) => (
          <div key={stage.id} className="snap-start shrink-0 w-80 flex flex-col bg-gray-100 rounded-lg p-3">
            <div className="flex justify-between items-center mb-4 px-1">
              <h3 className="font-semibold text-gray-700">{stage.name}</h3>
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full font-medium">
                {stage.buyers.length}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-[100px]">
              {stage.buyers.map((b: any) => (
                <div key={b.id} className="bg-white p-3 rounded shadow-sm border mb-2 cursor-pointer hover:border-blue-400 transition-colors">
                  <p className="font-medium text-sm text-gray-900">{b.name}</p>
                </div>
              ))}
              {stage.buyers.length === 0 && (
                <div className="h-full border-2 border-dashed border-gray-300 rounded flex items-center justify-center opacity-50 p-4">
                  <p className="text-xs text-center text-gray-500">Пусто</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
