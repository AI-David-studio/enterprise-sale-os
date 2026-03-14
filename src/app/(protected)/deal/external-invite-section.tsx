'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createExternalInvite, revokeExternalAccess } from '@/actions/external-invite'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExternalInvite {
  id: string
  email: string
  status: string
  created_at: string
  accepted_at: string | null
  expires_at: string
}

interface ExternalAccess {
  id: string
  invited_email: string
  created_at: string
}

interface ExternalInviteSectionProps {
  dealId: string
  externalInvites: ExternalInvite[]
  activeExternalAccess: ExternalAccess[]
  externalReadError?: string | null
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function statusLabel(status: string): { text: string; className: string } {
  switch (status) {
    case 'pending':
      return { text: 'Ожидание', className: 'bg-yellow-100 text-yellow-800' }
    case 'accepted':
      return { text: 'Принято', className: 'bg-green-100 text-green-800' }
    case 'expired':
      return { text: 'Истекло', className: 'bg-gray-100 text-gray-600' }
    case 'revoked':
      return { text: 'Отменено', className: 'bg-red-100 text-red-700' }
    default:
      return { text: status, className: 'bg-gray-100 text-gray-600' }
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ExternalInviteSection({
  dealId,
  externalInvites,
  activeExternalAccess,
  externalReadError,
}: ExternalInviteSectionProps) {
  const router = useRouter()

  // --- Create invite state ---
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  // --- Revoke state ---
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revokeError, setRevokeError] = useState<string | null>(null)

  // ---- CREATE EXTERNAL INVITE ----
  async function handleCreateInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setInviteLink(null)
    setCopied(false)
    setLoading(true)

    try {
      const result = await createExternalInvite(dealId, email)
      if (result.success && result.inviteLink) {
        setInviteLink(result.inviteLink)
        setCopyError(null)
        setEmail('')
        router.refresh()
      } else {
        setError(result.error || 'Неизвестная ошибка.')
      }
    } catch {
      setError('Произошла непредвиденная ошибка. Попробуйте снова.')
    } finally {
      setLoading(false)
    }
  }

  // ---- COPY LINK ----
  async function handleCopy() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setCopyError(null)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError('Не удалось скопировать ссылку. Скопируйте её вручную.')
    }
  }

  // ---- REVOKE EXTERNAL ACCESS ----
  async function handleRevoke(accessId: string) {
    if (revokingId) return
    setRevokeError(null)
    setRevokingId(accessId)

    try {
      const result = await revokeExternalAccess(accessId, dealId)
      if (result.success) {
        router.refresh()
      } else {
        setRevokeError(result.error || 'Ошибка отзыва доступа.')
      }
    } catch {
      setRevokeError('Произошла непредвиденная ошибка.')
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div className="mt-8 bg-white p-6 rounded-lg border shadow-sm">
      <h2 className="text-xl font-semibold mb-1">Внешний доступ</h2>
      <p className="text-sm text-gray-500 mb-6">
        Создайте приглашение для внешнего пользователя (покупатель, партнёр).
        Внешний пользователь получит доступ только к документам, помеченным как внешние.
      </p>

      {/* ---- ERROR ---- */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* ---- READ ERROR ---- */}
      {externalReadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 mb-4 text-sm">
          {externalReadError}
        </div>
      )}

      {/* ---- SUCCESS: INVITE LINK ---- */}
      {inviteLink && (
        <div className="bg-green-50 border border-green-200 rounded-md px-4 py-3 mb-4">
          <p className="text-sm font-medium text-green-800 mb-2">
            Приглашение создано! Скопируйте ссылку и отправьте внешнему участнику:
          </p>
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
          {copyError && (
            <p className="text-xs text-red-500 mt-1">{copyError}</p>
          )}
        </div>
      )}

      {/* ---- CREATE INVITE FORM ---- */}
      <form onSubmit={handleCreateInvite} className="flex items-end gap-3 mb-8">
        <div className="flex-1">
          <label htmlFor="ext-invite-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email внешнего участника <span className="text-red-500">*</span>
          </label>
          <input
            id="ext-invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="w-full border rounded-md px-4 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="buyer@company.ru"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white font-medium px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? 'Создание…' : 'Пригласить'}
        </button>
      </form>

      {/* ---- EXTERNAL INVITES TABLE ---- */}
      <h3 className="text-lg font-semibold mb-3">Приглашения</h3>
      {externalInvites.length === 0 ? (
        <p className="text-sm text-gray-400 mb-6">Внешних приглашений ещё нет.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden mb-6">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 font-medium text-gray-500">Email</th>
                <th className="px-4 py-2 font-medium text-gray-500">Статус</th>
                <th className="px-4 py-2 font-medium text-gray-500">Создано</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {externalInvites.map((inv) => {
                const badge = statusLabel(inv.status)
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-gray-800">{inv.email}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${badge.className}`}>
                        {badge.text}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {new Date(inv.created_at).toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- ACTIVE EXTERNAL ACCESS TABLE ---- */}
      <h3 className="text-lg font-semibold mb-3">Активный внешний доступ</h3>

      {revokeError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 mb-3 text-sm">
          {revokeError}
        </div>
      )}

      {activeExternalAccess.length === 0 ? (
        <p className="text-sm text-gray-400">Активных внешних доступов нет.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 font-medium text-gray-500">Email</th>
                <th className="px-4 py-2 font-medium text-gray-500">Выдан</th>
                <th className="px-4 py-2 font-medium text-gray-500">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {activeExternalAccess.map((acc) => (
                <tr key={acc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-gray-800">{acc.invited_email}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {new Date(acc.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => handleRevoke(acc.id)}
                      disabled={revokingId === acc.id}
                      className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {revokingId === acc.id ? 'Отзыв…' : 'Отозвать'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
