import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { ExternalInviteClient } from './external-invite-client'

interface ExternalInvitePageProps {
  params: Promise<{ token: string }>
}

export default async function ExternalInvitePage({ params }: ExternalInvitePageProps) {
  const { token } = await params

  // Validate the external invite token server-side via admin client
  const admin = createAdminClient()

  const { data: invite, error: inviteError } = await admin
    .from('external_invites')
    .select('id, deal_id, email, status, expires_at, invited_by')
    .eq('token', token)
    .limit(1)
    .maybeSingle()

  // --- Invalid states ---
  if (inviteError || !invite) {
    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-lg justify-center pt-20 mx-auto">
        <div className="bg-gray-50 border rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">Приглашение не найдено</h1>
          <p className="text-gray-600">Приглашение с данным кодом не найдено. Проверьте правильность ссылки.</p>
          <a href="/login" className="inline-block mt-4 text-blue-600 hover:underline text-sm">
            Перейти на страницу входа
          </a>
        </div>
      </div>
    )
  }

  if (invite.status === 'accepted') {
    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-lg justify-center pt-20 mx-auto">
        <div className="bg-gray-50 border rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">Приглашение использовано</h1>
          <p className="text-gray-600">Это приглашение уже было принято.</p>
          <a href="/portal" className="inline-block mt-4 text-blue-600 hover:underline text-sm">
            Перейти в портал
          </a>
        </div>
      </div>
    )
  }

  if (invite.status === 'revoked') {
    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-lg justify-center pt-20 mx-auto">
        <div className="bg-gray-50 border rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">Приглашение отменено</h1>
          <p className="text-gray-600">Это приглашение было отменено. Обратитесь к отправителю для получения нового.</p>
        </div>
      </div>
    )
  }

  if (invite.status === 'expired' || new Date(invite.expires_at) < new Date()) {
    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-lg justify-center pt-20 mx-auto">
        <div className="bg-gray-50 border rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">Приглашение истекло</h1>
          <p className="text-gray-600">Срок действия приглашения истёк. Обратитесь к отправителю для получения нового.</p>
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
    <ExternalInviteClient
      token={token}
      inviteEmail={invite.email}
      currentUser={currentUser}
    />
  )
}
