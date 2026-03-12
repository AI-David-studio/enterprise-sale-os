'use client'

import { useState } from 'react'
import { createInvite } from '@/actions/invite'

interface InviteSectionProps {
  dealId: string
}

export function InviteSection({ dealId }: InviteSectionProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'advisor' | 'viewer'>('advisor')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return

    setError(null)
    setInviteLink(null)
    setCopied(false)
    setLoading(true)

    try {
      const result = await createInvite(dealId, email, role)

      if (result.success && result.inviteLink) {
        setInviteLink(result.inviteLink)
        setEmail('')
      } else {
        setError(result.error || 'Неизвестная ошибка.')
      }
    } catch {
      setError('Произошла непредвиденная ошибка. Попробуйте снова.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text in the input
    }
  }

  return (
    <div className="mt-8 bg-white p-6 rounded-lg border shadow-sm">
      <h2 className="text-xl font-semibold mb-1">Пригласить участника</h2>
      <p className="text-sm text-gray-500 mb-4">
        Создайте одноразовую ссылку-приглашение для консультанта или наблюдателя. Ссылка действительна 7 дней.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {inviteLink && (
        <div className="bg-green-50 border border-green-200 rounded-md px-4 py-3 mb-4">
          <p className="text-sm font-medium text-green-800 mb-2">Приглашение создано! Скопируйте ссылку и отправьте участнику:</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="flex-1 bg-white border rounded-md px-3 py-2 text-sm font-mono text-gray-700 select-all"
              onClick={(e) => (e.target as HTMLInputElement).select()}
              aria-label="Ссылка приглашения"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 bg-green-600 text-white text-sm font-medium px-3 py-2 rounded-md hover:bg-green-700 transition-colors"
            >
              {copied ? 'Скопировано!' : 'Копировать'}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email участника <span className="text-red-500">*</span>
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-md px-4 py-2"
            placeholder="partner@company.ru"
            required
          />
        </div>

        <div>
          <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 mb-1">
            Роль <span className="text-red-500">*</span>
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'advisor' | 'viewer')}
            className="w-full border rounded-md px-4 py-2 bg-white"
            aria-label="Выберите роль"
          >
            <option value="advisor">Консультант (чтение + документы)</option>
            <option value="viewer">Наблюдатель (только чтение)</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white font-medium px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Создание…' : 'Создать приглашение'}
        </button>
      </form>
    </div>
  )
}
