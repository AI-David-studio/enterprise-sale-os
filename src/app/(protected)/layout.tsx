import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

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

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-white px-6">
        <div className="flex flex-1 items-center justify-between">
          <div className="font-semibold text-lg text-blue-900 border-r pr-6 mr-6">
            <a href="/dashboard">Enterprise Sale OS</a>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium flex-1">
            <a href="/deal" className="text-gray-600 hover:text-blue-600 transition-colors">Сделка</a>
            <a href="/buyers" className="text-gray-600 hover:text-blue-600 transition-colors">Покупатели</a>
            <a href="/pipeline" className="text-gray-600 hover:text-blue-600 transition-colors">Воронка</a>
            <a href="/documents" className="text-gray-600 hover:text-blue-600 transition-colors">Документы</a>
            <a href="/communications" className="text-gray-600 hover:text-blue-600 transition-colors">История коммуникаций</a>
            <a href="/tasks" className="text-gray-600 hover:text-blue-600 transition-colors">Задачи</a>
          </nav>
          <div className="flex items-center">
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
        {children}
      </main>
    </div>
  )
}
