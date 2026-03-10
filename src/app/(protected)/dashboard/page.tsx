import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // Get active deal
  const { data: deals } = await supabase.from('deals').select('*').limit(1)
  const activeDeal = deals?.[0]

  if (!activeDeal) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">Панель управления</h1>
        <div className="bg-white p-12 text-center text-gray-500 rounded-lg shadow-sm border border-gray-200">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Нет активных сделок</h3>
          <p>Пожалуйста, создайте или выберите сделку для начала работы системы.</p>
        </div>
      </div>
    )
  }

  // Parallel data fetching for metrics
  const [
    { count: buyersCount },
    { count: pendingTasksCount },
    { count: pendingAiCount },
    { data: pendingTasks },
    { data: recentTasks },
    { data: recentComms },
    { data: recentAis }
  ] = await Promise.all([
    supabase.from('buyers').select('*', { count: 'exact', head: true }).eq('deal_id', activeDeal.id),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('deal_id', activeDeal.id).eq('status', 'pending'),
    supabase.from('ai_outputs').select('*', { count: 'exact', head: true }).eq('deal_id', activeDeal.id).eq('status', 'pending_review'),
    supabase.from('tasks').select('*').eq('deal_id', activeDeal.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
    supabase.from('tasks').select('*').eq('deal_id', activeDeal.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('communications').select('*, buyers!inner(deal_id)').eq('buyers.deal_id', activeDeal.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('ai_outputs').select('*').eq('deal_id', activeDeal.id).order('created_at', { ascending: false }).limit(5)
  ])

  // Aggregate recent activity
  type ActivityItem = {
    id: string;
    type: 'task' | 'communication' | 'ai_output';
    title: string;
    description: string;
    date: Date;
  }
  
  const activities: ActivityItem[] = []

  if (recentTasks) {
    recentTasks.forEach(t => {
      activities.push({
        id: `task-${t.id}`,
        type: 'task',
        title: t.status === 'completed' ? 'Выполнена задача' : 'Добавлена задача',
        description: t.title,
        date: new Date(t.created_at)
      })
    })
  }

  if (recentComms) {
    recentComms.forEach(c => {
      activities.push({
        id: `comm-${c.id}`,
        type: 'communication',
        title: `Лог коммуникации: ${c.type}`,
        description: c.content ? (c.content.length > 60 ? c.content.substring(0, 60) + '...' : c.content) : '',
        date: new Date(c.created_at)
      })
    })
  }

  if (recentAis) {
    recentAis.forEach(a => {
      activities.push({
        id: `ai-${a.id}`,
        type: 'ai_output',
        title: 'ИИ-черновик сгенерирован',
        description: a.status === 'pending_review' ? 'Ожидает проверки' : 'Обработан',
        date: new Date(a.created_at)
      })
    })
  }

  // Sort unified feed by date descending
  activities.sort((a, b) => b.date.getTime() - a.date.getTime())
  const topActivities = activities.slice(0, 5)

  // Format dates
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">Панель управления</h1>
        <p className="mt-2 text-gray-500">Оперативный обзор сделки: <span className="font-semibold text-gray-700">{activeDeal.name}</span></p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Всего покупателей</h3>
            <p className="text-3xl font-bold text-blue-700">{buyersCount || 0}</p>
          </div>
          <div className="mt-4">
            <Link href="/buyers" className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center">
              Смотреть все
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Ожидающие задачи</h3>
            <p className="text-3xl font-bold text-orange-600">{pendingTasksCount || 0}</p>
          </div>
          <div className="mt-4">
            <Link href="/tasks" className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center">
              Смотреть все
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Черновики ИИ</h3>
            <p className="text-3xl font-bold text-purple-600">{pendingAiCount || 0}</p>
          </div>
          <div className="mt-4">
            <Link href="/ai-review" className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center">
              Смотреть все
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pending Tasks Panel */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
            <h2 className="text-lg font-semibold text-gray-900">Ожидающие задачи</h2>
            <Link href="/tasks" className="text-sm text-blue-600 hover:text-blue-800 font-medium">Смотреть все</Link>
          </div>
          <div className="p-0">
            {pendingTasks && pendingTasks.length > 0 ? (
              <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {pendingTasks.map((task) => (
                  <li key={task.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 mt-0.5">
                        <input
                          type="checkbox"
                          disabled
                          title="Ожидающая задача"
                          className="h-5 w-5 text-blue-600 border-gray-300 rounded cursor-not-allowed opacity-50"
                        />
                      </div>
                      <div className="ml-4 flex-1">
                        <p className="text-sm font-medium text-gray-900">{task.title}</p>
                        <p className="text-xs text-gray-500 mt-1">Добавлено: {formatDate(new Date(task.created_at))}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                <p>Нет ожидающих задач</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Panel */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <h2 className="text-lg font-semibold text-gray-900">Последняя активность</h2>
          </div>
          <div className="p-0">
            {topActivities.length > 0 ? (
              <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {topActivities.map((activity) => (
                  <li key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex">
                      <div className="flex-shrink-0 mr-4">
                        {activity.type === 'task' && (
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                          </div>
                        )}
                        {activity.type === 'communication' && (
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                          </div>
                        )}
                        {activity.type === 'ai_output' && (
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
                        <p className="text-sm text-gray-500 truncate">{activity.description}</p>
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        <p className="text-xs text-gray-400 whitespace-nowrap">{formatDate(activity.date)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <p>Нет недавней активности</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

