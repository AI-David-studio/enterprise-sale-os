import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const signIn = async (formData: FormData) => {
    'use server'

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return redirect('/login?message=Ошибка+авторизации')
    }

    return redirect('/dashboard')
  }

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 pt-20 mx-auto">
      <form className="flex-1 flex flex-col w-full justify-center gap-2 text-foreground" action={signIn}>
        <h1 className="text-2xl font-semibold text-center mb-6">Вход в систему</h1>
        
        <label className="text-md" htmlFor="email">
          Электронная почта
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
        />
        
        <label className="text-md" htmlFor="password">
          Пароль
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          type="password"
          name="password"
          placeholder="••••••••"
          required
        />
        
        <button className="bg-blue-600 text-white rounded-md px-4 py-2 text-foreground mb-2">
          Войти
        </button>
      </form>
    </div>
  )
}
