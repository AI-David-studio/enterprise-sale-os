'use server'

import { randomBytes } from 'crypto'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isDealOwner } from '@/utils/roles'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExternalInviteResult {
  success: boolean
  error?: string
  inviteLink?: string
  token?: string
}

interface ExternalAccessRevokeResult {
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXTERNAL_INVITE_EXPIRY_DAYS = 7
const TOKEN_BYTES = 32 // 256 bits of entropy → 64 hex chars

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSiteOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SITE_URL
  if (!url) return null
  return url.replace(/\/+$/, '')
}

// ---------------------------------------------------------------------------
// 1. CREATE EXTERNAL INVITE (lead_advisor only)
// ---------------------------------------------------------------------------

/**
 * Creates an external invite for a buyer-side evaluator.
 * 
 * This is a SEPARATE path from internal invites (src/actions/invite.ts).
 * External invites use their own table (external_invites) and acceptance
 * creates external_access rows, NOT deal_members rows.
 * 
 * Only lead_advisor can create external invites.
 */
export async function createExternalInvite(
  dealId: string,
  inviteeEmail: string
): Promise<ExternalInviteResult> {
  // --- Auth check ---
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Необходимо войти в систему.' }
  }

  // --- Input validation ---
  const email = inviteeEmail?.trim().toLowerCase()
  if (!email) {
    return { success: false, error: 'Укажите email приглашённого пользователя.' }
  }

  if (!dealId) {
    return { success: false, error: 'Не указана сделка для приглашения.' }
  }

  // --- Site origin check ---
  const siteOrigin = getSiteOrigin()
  if (!siteOrigin) {
    return {
      success: false,
      error: 'Серверная конфигурация неполна: не задан NEXT_PUBLIC_SITE_URL.',
    }
  }

  // --- Authority check: caller must be lead_advisor ---
  try {
    const isOwner = await isDealOwner(user.id, dealId)
    if (!isOwner) {
      return { success: false, error: 'Только владелец сделки может создавать внешние приглашения.' }
    }
  } catch (err) {
    console.error('createExternalInvite: authority check failed', err)
    return { success: false, error: 'Ошибка проверки прав доступа.' }
  }

  const admin = createAdminClient()

  // --- Check for existing pending external invite ---
  const { data: existingInvite, error: lookupError } = await admin
    .from('external_invites')
    .select('id, token, expires_at')
    .eq('deal_id', dealId)
    .eq('email', email)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()

  if (lookupError) {
    console.error('createExternalInvite: pending invite lookup failed', lookupError)
    return { success: false, error: 'Ошибка проверки существующих приглашений.' }
  }

  if (existingInvite) {
    return {
      success: true,
      token: existingInvite.token,
      inviteLink: `${siteOrigin}/external-invite/${existingInvite.token}`,
    }
  }

  // --- Generate secure token ---
  const token = randomBytes(TOKEN_BYTES).toString('hex')

  // --- Calculate expiry ---
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + EXTERNAL_INVITE_EXPIRY_DAYS)

  // --- Insert external invite ---
  const { error: insertError } = await admin
    .from('external_invites')
    .insert({
      deal_id: dealId,
      email,
      token,
      status: 'pending',
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
    })

  if (insertError) {
    // Race condition: partial unique index fired
    if (insertError.code === '23505') {
      const { data: raceWinner, error: reQueryError } = await admin
        .from('external_invites')
        .select('id, token')
        .eq('deal_id', dealId)
        .eq('email', email)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle()

      if (reQueryError || !raceWinner) {
        return { success: false, error: 'Приглашение уже создаётся. Обновите страницу.' }
      }

      return {
        success: true,
        token: raceWinner.token,
        inviteLink: `${siteOrigin}/external-invite/${raceWinner.token}`,
      }
    }

    console.error('createExternalInvite: insert failed', insertError)
    return { success: false, error: `Ошибка создания приглашения: ${insertError.message}` }
  }

  return {
    success: true,
    token,
    inviteLink: `${siteOrigin}/external-invite/${token}`,
  }
}

// ---------------------------------------------------------------------------
// 2. ACCEPT EXTERNAL INVITE (creates external_access, NOT deal_members)
// ---------------------------------------------------------------------------

/**
 * Accepts an external invite for a new or existing authenticated user.
 * Creates an external_access row. Does NOT create a deal_members row.
 * Does NOT assign the user to the seller's organization.
 */
export async function acceptExternalInvite(
  token: string,
  password?: string,
  firstName?: string,
  lastName?: string
): Promise<ExternalInviteResult> {
  if (!token?.trim()) {
    return { success: false, error: 'Приглашение не найдено.' }
  }

  const admin = createAdminClient()

  // --- Fetch invite ---
  const { data: invite, error: inviteError } = await admin
    .from('external_invites')
    .select('id, deal_id, email, status, expires_at, invited_by')
    .eq('token', token.trim())
    .limit(1)
    .maybeSingle()

  if (inviteError || !invite) {
    return { success: false, error: 'Приглашение не найдено.' }
  }

  if (invite.status !== 'pending') {
    return { success: false, error: 'Приглашение уже использовано или отменено.' }
  }

  if (new Date(invite.expires_at) < new Date()) {
    try {
      await admin
        .from('external_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id)
    } catch { /* ignore lazy expiry update failure */ }

    return { success: false, error: 'Приглашение истекло.' }
  }

  const email = invite.email.trim().toLowerCase()
  const supabase = await createClient()
  let userId: string | undefined

  // --- Determine if this is a new or existing user ---
  const { data: { user: existingUser } } = await supabase.auth.getUser()

  if (existingUser) {
    // Existing authenticated user — verify email binding
    const userEmail = (existingUser.email ?? '').trim().toLowerCase()
    if (userEmail !== email) {
      return { success: false, error: 'Это приглашение предназначено для другого email-адреса.' }
    }
    userId = existingUser.id
  } else if (password && firstName && lastName) {
    // New account registration (inline)
    const trimmedPassword = password.trim()
    const trimmedFirst = firstName.trim()
    const trimmedLast = lastName.trim()

    if (!trimmedPassword || !trimmedFirst || !trimmedLast) {
      return { success: false, error: 'Заполните все обязательные поля.' }
    }

    if (trimmedPassword.length < 8) {
      return { success: false, error: 'Пароль должен содержать минимум 8 символов.' }
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: trimmedPassword,
    })

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        return { success: false, error: 'Пользователь уже зарегистрирован. Войдите в систему.' }
      }
      return { success: false, error: `Ошибка регистрации: ${signUpError.message}` }
    }

    userId = signUpData.user?.id
    if (!userId) {
      return { success: false, error: 'Не удалось создать аккаунт.' }
    }

    if (!signUpData.session) {
      await admin.auth.admin.deleteUser(userId).catch(() => {})
      return { success: false, error: 'Требуется подтверждение email. Обратитесь к администратору.' }
    }

    // Create user profile WITHOUT organization assignment
    const { error: profileError } = await admin.from('users').insert({
      id: userId,
      organization_id: null,
      email,
      first_name: trimmedFirst,
      last_name: trimmedLast,
      user_type: 'external',
    })

    if (profileError) {
      // Cleanup auth user on profile failure
      await supabase.auth.signOut().catch(() => {})
      await admin.auth.admin.deleteUser(userId).catch(() => {})
      return { success: false, error: 'Ошибка создания профиля.' }
    }
  } else {
    return { success: false, error: 'Необходимо войти в систему или заполнить регистрационные данные.' }
  }

  // --- Check for existing active external access ---
  const { data: existing, error: existingError } = await admin
    .from('external_access')
    .select('id')
    .eq('deal_id', invite.deal_id)
    .eq('user_id', userId!)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle()

  if (existingError) {
    console.error('acceptExternalInvite: existing access lookup failed', existingError)
    return { success: false, error: 'Ошибка проверки доступа.' }
  }

  if (existing) {
    // Already has active access — mark invite accepted and succeed silently
    try {
      await admin
        .from('external_invites')
        .update({ status: 'accepted', accepted_by: userId!, accepted_at: new Date().toISOString() })
        .eq('id', invite.id)
        .eq('status', 'pending')
    } catch { /* ignore idempotent update failure */ }

    return { success: true }
  }

  // --- Mark invite as accepted (optimistic lock) ---
  const { data: updatedRows, error: inviteUpdateError } = await admin
    .from('external_invites')
    .update({
      status: 'accepted',
      accepted_by: userId!,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id)
    .eq('status', 'pending')
    .select('id')

  if (inviteUpdateError) {
    return { success: false, error: 'Ошибка обновления приглашения.' }
  }

  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: 'Приглашение уже обработано.' }
  }

  // --- Create external_access row (NOT deal_members) ---
  const { error: accessError } = await admin
    .from('external_access')
    .insert({
      deal_id: invite.deal_id,
      user_id: userId!,
      invited_email: email,
      granted_by: invite.invited_by,
    })

  if (accessError) {
    // Duplicate = success
    if (accessError.code === '23505') {
      return { success: true }
    }

    // Revert invite status
    try {
      await admin
        .from('external_invites')
        .update({ status: 'pending', accepted_by: null, accepted_at: null })
        .eq('id', invite.id)
    } catch { /* ignore cleanup error */ }

    console.error('acceptExternalInvite: external_access insert failed', accessError)
    return { success: false, error: 'Ошибка создания внешнего доступа.' }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// 3. REVOKE EXTERNAL ACCESS (lead_advisor only)
// ---------------------------------------------------------------------------

/**
 * Revokes an active external access grant. The revoked row remains
 * in the table for audit purposes (revoked_at is set, not deleted).
 * Only lead_advisor of the deal can revoke.
 */
export async function revokeExternalAccess(
  externalAccessId: string,
  dealId: string
): Promise<ExternalAccessRevokeResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Необходимо войти в систему.' }
  }

  try {
    const isOwner = await isDealOwner(user.id, dealId)
    if (!isOwner) {
      return { success: false, error: 'Только владелец сделки может отозвать доступ.' }
    }
  } catch (err) {
    console.error('revokeExternalAccess: authority check failed', err)
    return { success: false, error: 'Ошибка проверки прав доступа.' }
  }

  const admin = createAdminClient()

  const { data: updated, error: updateError } = await admin
    .from('external_access')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: user.id,
    })
    .eq('id', externalAccessId)
    .eq('deal_id', dealId)
    .is('revoked_at', null)
    .select('id')

  if (updateError) {
    console.error('revokeExternalAccess: update failed', updateError)
    return { success: false, error: 'Ошибка отзыва доступа.' }
  }

  if (!updated || updated.length === 0) {
    return { success: false, error: 'Доступ уже отозван или не найден.' }
  }

  return { success: true }
}
