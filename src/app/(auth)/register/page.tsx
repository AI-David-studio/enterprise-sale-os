'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerSeller } from '@/actions/register'

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return // prevent duplicate submissions

    setError(null)
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const result = await registerSeller(formData)

      if (result.success) {
        router.push('/dashboard')
        return
      }

      if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      console.error('Registration error:', err)
      setError('Произошла непредвиденная ошибка. Попробуйте снова.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 pt-12 mx-auto">
      <form
        className="flex-1 flex flex-col w-full justify-center gap-2 text-foreground"
        onSubmit={handleSubmit}
      >
        <h1 className="text-2xl font-semibold text-center mb-6">
          Регистрация
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <label className="text-md" htmlFor="email">
          Электронная почта <span className="text-red-500">*</span>
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-4"
          name="email"
          id="email"
          type="email"
          placeholder="ivanov@company.ru"
          required
        />

        <label className="text-md" htmlFor="password">
          Пароль <span className="text-red-500">*</span>
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-4"
          type="password"
          name="password"
          id="password"
          placeholder="Минимум 8 символов"
          minLength={8}
          required
        />

        <label className="text-md" htmlFor="first_name">
          Имя <span className="text-red-500">*</span>
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-4"
          name="first_name"
          id="first_name"
          type="text"
          placeholder="Иван"
          required
        />

        <label className="text-md" htmlFor="last_name">
          Фамилия <span className="text-red-500">*</span>
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-4"
          name="last_name"
          id="last_name"
          type="text"
          placeholder="Петров"
          required
        />

        <label className="text-md" htmlFor="organization_name">
          Компания <span className="text-red-500">*</span>
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-4"
          name="organization_name"
          id="organization_name"
          type="text"
          placeholder="ООО «Ваша компания»"
          required
        />

        <label className="text-md" htmlFor="job_title">
          Должность
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-4"
          name="job_title"
          id="job_title"
          type="text"
          placeholder="Генеральный директор"
        />

        <label className="text-md" htmlFor="phone">
          Телефон
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          name="phone"
          id="phone"
          type="tel"
          placeholder="+7 (999) 123-45-67"
        />

        <button
          type="submit"
          className="bg-blue-600 text-white rounded-md px-4 py-2 text-foreground mb-2 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Создание аккаунта…' : 'Создать аккаунт'}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          Уже есть аккаунт?{' '}
          <a href="/login" className="text-blue-600 hover:underline">
            Войти
          </a>
        </p>
      </form>
    </div>
  )
}
