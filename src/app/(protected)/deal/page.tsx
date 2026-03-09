import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function DealPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // Find user's organization to load its active deal
  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const { data: deals, error } = await supabase
    .from('deals')
    .select('id, name, description, target_industry')
    .eq('organization_id', profile?.organization_id)
    .limit(1)

  const activeDeal = deals?.[0]

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Настройки Сделки</h1>
        <p className="text-gray-500">
          Здесь вы можете настроить параметры вашей активной сделки. Система поддерживает только одну активную операционную сделку.
        </p>
      </div>

      <form className="space-y-6 bg-white p-6 rounded-lg border shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Название проекта (Кодовое имя)</label>
          <input
            type="text"
            className="w-full border rounded-md px-4 py-2"
            defaultValue={activeDeal?.name || ''}
            placeholder="Проект Альфа"
            disabled
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Описание / Статус</label>
          <textarea
            className="w-full border rounded-md px-4 py-2 h-24"
            defaultValue={activeDeal?.description || ''}
            placeholder="Конфиденциальная продажа актива..."
            disabled
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Индустрия цели</label>
          <input
            type="text"
            className="w-full border rounded-md px-4 py-2"
            defaultValue={activeDeal?.target_industry || ''}
            placeholder="SaaS / Technology"
            disabled
          />
        </div>

        <div className="pt-4 border-t">
          <button
            type="button"
            className="bg-gray-100 text-gray-400 font-medium px-4 py-2 rounded-md cursor-not-allowed"
            disabled
          >
            Сохранить изменения (Заглушка)
          </button>
        </div>
      </form>
    </div>
  )
}
