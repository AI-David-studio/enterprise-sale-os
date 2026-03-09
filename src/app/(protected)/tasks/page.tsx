import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function TasksPage() {
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

  let tasks: any[] = []
  if (activeDealId) {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('deal_id', activeDealId)
      .order('created_at', { ascending: false })
    tasks = data || []
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Задачи</h1>
          <p className="text-gray-500">Операционный чек-лист для ведения сделки.</p>
        </div>
        <button disabled className="bg-blue-600 opacity-50 text-white px-4 py-2 rounded-md font-medium">
          + Добавить задачу
        </button>
      </div>

      <div className="bg-white border rounded-lg shadow-sm">
        {tasks.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {tasks.map((task) => (
              <li key={task.id} className="p-4 flex items-start hover:bg-gray-50">
                <div className="flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={task.status === 'completed'}
                    disabled
                    className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-not-allowed"
                  />
                </div>
                <div className="ml-4 flex-1">
                  <h3 className={`text-base font-medium ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className={`mt-1 text-sm ${task.status === 'completed' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {task.description}
                    </p>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0 text-sm text-gray-400">
                  {new Date(task.created_at).toLocaleDateString('ru-RU')}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-12 text-center text-gray-500">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p>План задач пуст. Добавьте задачи для организации процесса сделки.</p>
          </div>
        )}
      </div>
    </div>
  )
}
