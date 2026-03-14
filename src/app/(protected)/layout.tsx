import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentUserActiveDealContext } from '@/utils/roles'
import { Toaster } from 'react-hot-toast'
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // Resolve current user's deal context for nav visibility
  let roleName: string | null = null
  try {
    const ctx = await getCurrentUserActiveDealContext(user.id)
    roleName = ctx?.roleName ?? null
  } catch {
    // Role resolution failed — restricted items stay hidden (fail-closed)
    console.error('ProtectedLayout: role resolution failed for user', user.id)
  }

  // Nav visibility: explicit allowlists (fail-closed)
  // null/unknown role = restricted items hidden
  const showAiReview = roleName === 'lead_advisor'
  const showCommunications = roleName === 'lead_advisor' || roleName === 'advisor'
  const showTasks = roleName === 'lead_advisor' || roleName === 'advisor'

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-white px-6">
        <div className="flex flex-1 items-center justify-between">
          <div className="font-semibold text-lg text-blue-900 border-r pr-6 mr-6">
            <a href="/dashboard">Enterprise Sale OS</a>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium flex-1">
            <a href="/dashboard" className="text-gray-600 hover:text-blue-600 transition-colors font-bold text-blue-800">Обзор</a>
            <a href="/deal" className="text-gray-600 hover:text-blue-600 transition-colors">Сделка</a>
            <a href="/buyers" className="text-gray-600 hover:text-blue-600 transition-colors">Покупатели</a>
            <a href="/pipeline" className="text-gray-600 hover:text-blue-600 transition-colors">Воронка</a>
            <a href="/documents" className="text-gray-600 hover:text-blue-600 transition-colors">Документы</a>
            {showCommunications && (
              <a href="/communications" className="text-gray-600 hover:text-blue-600 transition-colors">История коммуникаций</a>
            )}
            {showTasks && (
              <a href="/tasks" className="text-gray-600 hover:text-blue-600 transition-colors">Задачи</a>
            )}
            {showAiReview && (
              <a href="/ai-review" className="text-purple-600 hover:text-purple-800 font-bold transition-colors">Очередь ИИ</a>
            )}
          </nav>
          <div className="flex items-center gap-4">
            <a href="/profile" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Мой профиль</a>
            <form action={async () => {
              'use server'
              const supabase = await createClient()
              await supabase.auth.signOut()
              redirect('/login')
            }}>
              <button type="submit" className="text-sm font-medium text-gray-400 hover:text-gray-900">Выйти</button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6">
        <Toaster position="bottom-right" />
        {children}
      </main>
    </div>
  )
}
