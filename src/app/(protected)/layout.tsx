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
          <div className="font-semibold text-lg">Сделка</div>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <a href="/dashboard" className="text-blue-600">Панель управления</a>
            <form action={async () => {
              'use server'
              const supabase = await createClient()
              await supabase.auth.signOut()
              redirect('/login')
            }}>
              <button type="submit" className="text-gray-500 hover:text-gray-900">Выйти</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
