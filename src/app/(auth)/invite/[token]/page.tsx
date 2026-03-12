import { createClient } from '@/utils/supabase/server'
import { validateInviteToken } from '@/actions/invite'
import { InviteClient } from './invite-client'

interface InvitePageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params

  // Validate the invite token server-side
  const validation = await validateInviteToken(token)

  // --- Invalid / expired / used states ---
  if (!validation.valid || !validation.invite) {
    const statusMessages: Record<string, { title: string; description: string }> = {
      accepted: {
        title: 'Приглашение использовано',
        description: 'Это приглашение уже было принято.',
      },
      expired: {
        title: 'Приглашение истекло',
        description: 'Срок действия приглашения истёк. Обратитесь к владельцу сделки для получения нового приглашения.',
      },
      revoked: {
        title: 'Приглашение отменено',
        description: 'Это приглашение было отменено владельцем сделки.',
      },
      not_found: {
        title: 'Приглашение не найдено',
        description: 'Приглашение с данным кодом не найдено. Проверьте правильность ссылки.',
      },
    }

    const msg = statusMessages[validation.status || 'not_found'] || statusMessages.not_found

    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-lg justify-center pt-20 mx-auto">
        <div className="bg-gray-50 border rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">{msg.title}</h1>
          <p className="text-gray-600">{msg.description}</p>
          {validation.error && validation.error !== msg.description && (
            <p className="text-sm text-gray-500 mt-2">{validation.error}</p>
          )}
          <a
            href="/login"
            className="inline-block mt-4 text-blue-600 hover:underline text-sm"
          >
            Перейти на страницу входа
          </a>
        </div>
      </div>
    )
  }

  // --- Valid pending invite: check auth state ---
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const currentUser = user
    ? { id: user.id, email: user.email || '' }
    : null

  return (
    <InviteClient
      token={token}
      invite={validation.invite}
      currentUser={currentUser}
    />
  )
}
