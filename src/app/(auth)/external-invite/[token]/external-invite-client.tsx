'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { acceptExternalInvite } from '@/actions/external-invite'

interface ExternalInviteClientProps {
  token: string
  inviteEmail: string
  currentUser: {
    id: string
    email: string
  } | null
}

export function ExternalInviteClient({ token, inviteEmail, currentUser }: ExternalInviteClientProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // New account form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')

  const emailMatch =
    currentUser &&
    currentUser.email.trim().toLowerCase() === inviteEmail.trim().toLowerCase()

  // ---- ACCEPT: existing authenticated user ----
  async function handleAcceptExisting() {
    if (loading) return
    setError(null)
    setLoading(true)

    try {
      const result = await acceptExternalInvite(token)
      if (result.success) {
        setSuccess(true)
        setTimeout(() => router.push('/portal'), 1500)
      } else {
        setError(result.error || 'Ошибка принятия приглашения.')
      }
    } catch {
      setError('Произошла непредвиденная ошибка. Попробуйте снова.')
    } finally {
      setLoading(false)
    }
  }

  // ---- ACCEPT: new account ----
  async function handleAcceptNewAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)

    try {
      const result = await acceptExternalInvite(token, password, firstName, lastName)
      if (result.success) {
        setSuccess(true)
        setTimeout(() => router.push('/portal'), 1500)
      } else {
        setError(result.error || 'Ошибка регистрации.')
      }
    } catch {
      setError('Произошла непредвиденная ошибка. Попробуйте снова.')
    } finally {
      setLoading(false)
    }
  }

  // ---- SUCCESS STATE ----
  if (success) {
    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-lg justify-center pt-20 mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-green-800 mb-2">Приглашение принято!</h1>
          <p className="text-green-700">Перенаправляем в портал документов…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-lg justify-center pt-12 mx-auto">
      {/* Invite info header */}
      <div className="bg-white border rounded-lg p-6 mb-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4">Внешнее приглашение</h1>
        <p className="text-sm text-gray-600">
          Вам предоставляется внешний доступ к документам сделки.
        </p>
        <div className="mt-3 text-sm">
          <span className="font-medium text-gray-500">Email приглашения: </span>
          <span className="text-gray-900 font-mono">{inviteEmail}</span>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* PATH A: Authenticated user with matching email */}
      {currentUser && emailMatch && (
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <p className="text-sm text-gray-600 mb-4">
            Вы вошли как <strong>{currentUser.email}</strong>. Нажмите кнопку ниже, чтобы принять приглашение.
          </p>
          <button
            onClick={handleAcceptExisting}
            disabled={loading}
            className="w-full bg-blue-600 text-white font-medium px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Принятие…' : 'Принять приглашение'}
          </button>
        </div>
      )}

      {/* PATH B: Authenticated user with NON-matching email */}
      {currentUser && !emailMatch && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-sm text-yellow-800">
            Вы вошли как <strong>{currentUser.email}</strong>, но приглашение предназначено для <strong>{inviteEmail}</strong>.
          </p>
          <p className="text-sm text-yellow-700 mt-2">
            Выйдите из текущего аккаунта и войдите или зарегистрируйтесь с адресом <strong>{inviteEmail}</strong>.
          </p>
        </div>
      )}

      {/* PATH C: Unauthenticated user */}
      {!currentUser && (
        <>
          {/* Option 1: Login with existing account */}
          <div className="bg-white border rounded-lg p-6 shadow-sm mb-4">
            <h2 className="text-lg font-semibold mb-2">Уже есть аккаунт?</h2>
            <p className="text-sm text-gray-600 mb-3">
              Войдите в систему, чтобы принять приглашение.
            </p>
            <a
              href={`/login?redirect=${encodeURIComponent(`/external-invite/${token}`)}`}
              className="inline-block bg-blue-600 text-white font-medium px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-center"
            >
              Войти
            </a>
          </div>

          {/* Option 2: Create new account inline */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Нет аккаунта?</h2>
            <p className="text-sm text-gray-600 mb-4">
              Создайте аккаунт и примите приглашение.
            </p>

            <form onSubmit={handleAcceptNewAccount} className="space-y-4">
              <div>
                <label htmlFor="ext-invite-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Электронная почта
                </label>
                <input
                  id="ext-invite-email"
                  type="email"
                  value={inviteEmail}
                  readOnly
                  disabled
                  className="w-full border rounded-md px-4 py-2 bg-gray-100 text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label htmlFor="ext-invite-first-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Имя <span className="text-red-500">*</span>
                </label>
                <input
                  id="ext-invite-first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full border rounded-md px-4 py-2"
                  placeholder="Иван"
                  required
                />
              </div>

              <div>
                <label htmlFor="ext-invite-last-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Фамилия <span className="text-red-500">*</span>
                </label>
                <input
                  id="ext-invite-last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full border rounded-md px-4 py-2"
                  placeholder="Петров"
                  required
                />
              </div>

              <div>
                <label htmlFor="ext-invite-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Пароль <span className="text-red-500">*</span>
                </label>
                <input
                  id="ext-invite-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border rounded-md px-4 py-2"
                  placeholder="Минимум 8 символов"
                  minLength={8}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white font-medium px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Создание аккаунта…' : 'Создать аккаунт и принять'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
