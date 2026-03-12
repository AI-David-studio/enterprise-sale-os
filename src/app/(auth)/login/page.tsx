import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Sanitizes a redirect target to prevent open-redirect attacks.
 * Only allows internal app-relative paths starting with '/'.
 * Rejects external URLs, protocol-relative URLs, and /login (loop prevention).
 */
function normalizeRedirectTarget(value: string | undefined): string {
  if (!value) return '/dashboard'
  const trimmed = value.trim()
  // Must start with exactly one '/' and not with '//'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/dashboard'
  // Block protocol schemes embedded in path-like strings
  if (trimmed.includes('://')) return '/dashboard'
  // Prevent redirect loop back to login
  if (trimmed === '/login' || trimmed.startsWith('/login?')) return '/dashboard'
  return trimmed
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; redirect?: string }>
}) {
  const params = await searchParams
  const redirectTo = normalizeRedirectTarget(params.redirect)

  const signIn = async (formData: FormData) => {
    'use server'

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const rawTarget = formData.get('redirect_to') as string
    const supabase = await createClient()

    // Re-sanitize on server side (hidden field could be tampered)
    const target = (() => {
      if (!rawTarget) return '/dashboard'
      const t = rawTarget.trim()
      if (!t.startsWith('/') || t.startsWith('//')) return '/dashboard'
      if (t.includes('://')) return '/dashboard'
      if (t === '/login' || t.startsWith('/login?')) return '/dashboard'
      return t
    })()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      const errorParams = new URLSearchParams({
        message: 'Ошибка авторизации',
      })
      if (target !== '/dashboard') {
        errorParams.set('redirect', target)
      }
      return redirect('/login?' + errorParams.toString())
    }

    return redirect(target)
  }

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 pt-20 mx-auto">
      <form className="flex-1 flex flex-col w-full justify-center gap-2 text-foreground" action={signIn}>
        <h1 className="text-2xl font-semibold text-center mb-6">Вход в систему</h1>

        {params.message && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 mb-4 text-sm">
            {params.message}
          </div>
        )}

        {/* Hidden field to preserve redirect target across form submission */}
        <input type="hidden" name="redirect_to" value={redirectTo} />
        
        <label className="text-md" htmlFor="email">
          Электронная почта
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          name="email"
          type="email"
          placeholder="ivanov@company.ru"
          required
        />
        
        <label className="text-md" htmlFor="password">
          Пароль
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          type="password"
          name="password"
          placeholder="Введите пароль"
          required
        />
        
        <button className="bg-blue-600 text-white rounded-md px-4 py-2 text-foreground mb-2">
          Войти
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          Нет аккаунта?{' '}
          <a href="/register" className="text-blue-600 hover:underline">
            Зарегистрироваться
          </a>
        </p>
      </form>
    </div>
  )
}
