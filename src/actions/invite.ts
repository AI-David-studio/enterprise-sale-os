'use server'

import { randomBytes } from 'crypto'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isDealOwner, getRoleIdByName } from '@/utils/roles'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InviteResult {
  success: boolean
  error?: string
  inviteLink?: string
  token?: string
}

interface InviteValidation {
  valid: boolean
  status?: 'pending' | 'accepted' | 'expired' | 'revoked' | 'not_found'
  error?: string
  invite?: {
    id: string
    dealId: string
    dealName: string
    roleId: string
    roleName: string
    email: string
    inviterName: string
  }
}

interface AcceptResult {
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INVITE_EXPIRY_DAYS = 7
const TOKEN_BYTES = 32 // 256 bits of entropy → 64 hex chars
const ALLOWED_INVITE_ROLES = ['advisor', 'viewer'] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the site origin for building invite links.
 * Requires NEXT_PUBLIC_SITE_URL to be set.
 */
function getSiteOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SITE_URL
  if (!url) return null
  // Strip trailing slash for clean concatenation
  return url.replace(/\/+$/, '')
}

// ---------------------------------------------------------------------------
// 1. CREATE INVITE (seller / lead_advisor only)
// ---------------------------------------------------------------------------

export async function createInvite(
  dealId: string,
  inviteeEmail: string,
  roleName: string
): Promise<InviteResult> {
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

  if (!ALLOWED_INVITE_ROLES.includes(roleName as typeof ALLOWED_INVITE_ROLES[number])) {
    return { success: false, error: 'Недопустимая роль. Допустимые роли: advisor, viewer.' }
  }

  if (!dealId) {
    return { success: false, error: 'Не указана сделка для приглашения.' }
  }

  // --- Site origin check ---
  const siteOrigin = getSiteOrigin()
  if (!siteOrigin) {
    return {
      success: false,
      error: 'Серверная конфигурация неполна: не задан NEXT_PUBLIC_SITE_URL. Обратитесь к администратору.',
    }
  }

  // --- Authority check: caller must be lead_advisor for this deal ---
  try {
    const isOwner = await isDealOwner(user.id, dealId)
    if (!isOwner) {
      return { success: false, error: 'Только владелец сделки может создавать приглашения.' }
    }
  } catch (err) {
    console.error('createInvite: authority check failed', err)
    return { success: false, error: 'Ошибка проверки прав доступа. Попробуйте снова.' }
  }

  const admin = createAdminClient()

  // --- Resolve role ID ---
  let roleId: string | null
  try {
    roleId = await getRoleIdByName(roleName)
  } catch (err) {
    console.error('createInvite: role lookup failed', err)
    return { success: false, error: 'Ошибка поиска роли. Попробуйте снова.' }
  }
  if (!roleId) {
    return { success: false, error: `Роль "${roleName}" не найдена. Обратитесь к администратору.` }
  }

  // --- Duplicate-pending-invite check: reuse existing pending invite for same (deal, email) ---
  const { data: existingInvite, error: lookupError } = await admin
    .from('deal_invites')
    .select('id, token, role_id, expires_at')
    .eq('deal_id', dealId)
    .eq('email', email)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()

  if (lookupError) {
    console.error('createInvite: pending invite lookup failed', lookupError)
    return { success: false, error: 'Ошибка проверки существующих приглашений. Попробуйте снова.' }
  }

  if (existingInvite) {
    // If the existing pending invite has the same role, reuse it
    if (existingInvite.role_id === roleId) {
      return {
        success: true,
        token: existingInvite.token,
        inviteLink: `${siteOrigin}/invite/${existingInvite.token}`,
      }
    }
    // Different role for same email+deal: update the existing invite's role
    const { error: updateError } = await admin
      .from('deal_invites')
      .update({ role_id: roleId })
      .eq('id', existingInvite.id)

    if (updateError) {
      console.error('createInvite: role update failed', updateError)
      return { success: false, error: 'Ошибка обновления роли приглашения.' }
    }

    return {
      success: true,
      token: existingInvite.token,
      inviteLink: `${siteOrigin}/invite/${existingInvite.token}`,
    }
  }

  // --- Generate secure token ---
  const token = randomBytes(TOKEN_BYTES).toString('hex')

  // --- Calculate expiry ---
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS)

  // --- Insert invite (with race-condition recovery via partial unique index) ---
  const { error: insertError } = await admin
    .from('deal_invites')
    .insert({
      deal_id: dealId,
      role_id: roleId,
      email,
      token,
      status: 'pending',
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
    })

  if (insertError) {
    // Race condition: another concurrent request created the pending invite first
    // The partial unique index (deal_id, lower(email)) WHERE status='pending' fired
    if (insertError.code === '23505') {
      // Re-query to find the winning pending invite
      const { data: raceWinner, error: reQueryError } = await admin
        .from('deal_invites')
        .select('id, token, role_id')
        .eq('deal_id', dealId)
        .eq('email', email)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle()

      if (reQueryError || !raceWinner) {
        console.error('createInvite: race recovery re-query failed', reQueryError)
        return {
          success: false,
          error: 'Приглашение уже создаётся другим процессом. Обновите страницу и попробуйте снова.',
        }
      }

      // If the winning invite has a different role, update it
      if (raceWinner.role_id !== roleId) {
        const { error: raceUpdateError } = await admin
          .from('deal_invites')
          .update({ role_id: roleId })
          .eq('id', raceWinner.id)

        if (raceUpdateError) {
          console.error('createInvite: race recovery role update failed', raceUpdateError)
          // Still return the token — role was just wrong, link is usable
        }
      }

      return {
        success: true,
        token: raceWinner.token,
        inviteLink: `${siteOrigin}/invite/${raceWinner.token}`,
      }
    }

    console.error('createInvite: insert failed', insertError)
    return { success: false, error: `Ошибка создания приглашения: ${insertError.message}` }
  }

  return {
    success: true,
    token,
    inviteLink: `${siteOrigin}/invite/${token}`,
  }
}

// ---------------------------------------------------------------------------
// 2. VALIDATE INVITE TOKEN (server-side only)
// ---------------------------------------------------------------------------

export async function validateInviteToken(token: string): Promise<InviteValidation> {
  if (!token?.trim()) {
    return { valid: false, status: 'not_found', error: 'Приглашение не найдено.' }
  }

  const admin = createAdminClient()

  // Fetch invite with joined deal and role info
  const { data: invite, error } = await admin
    .from('deal_invites')
    .select(`
      id,
      deal_id,
      role_id,
      email,
      status,
      expires_at,
      invited_by,
      deals(name),
      deal_roles(name),
      users!deal_invites_invited_by_fkey(first_name, last_name)
    `)
    .eq('token', token.trim())
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('validateInviteToken: DB query failed', error)
    return { valid: false, status: 'not_found', error: 'Ошибка проверки приглашения. Попробуйте снова.' }
  }

  if (!invite) {
    return { valid: false, status: 'not_found', error: 'Приглашение не найдено.' }
  }

  // --- Status check ---
  if (invite.status === 'accepted') {
    return { valid: false, status: 'accepted', error: 'Приглашение уже использовано.' }
  }

  if (invite.status === 'revoked') {
    return { valid: false, status: 'revoked', error: 'Приглашение отменено.' }
  }

  if (invite.status === 'expired') {
    return { valid: false, status: 'expired', error: 'Приглашение истекло. Обратитесь к владельцу сделки.' }
  }

  // --- Lazy expiry check ---
  if (new Date(invite.expires_at) < new Date()) {
    // Lazily update status to expired — log failure but still report expired
    const { error: expiryUpdateError } = await admin
      .from('deal_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id)

    if (expiryUpdateError) {
      console.error('validateInviteToken: lazy expiry update failed', expiryUpdateError)
      // Still report as expired — the token IS expired regardless of DB update success
    }

    return { valid: false, status: 'expired', error: 'Приглашение истекло. Обратитесь к владельцу сделки.' }
  }

  // --- Build response ---
  const deal = invite.deals as unknown as { name: string } | null
  const role = invite.deal_roles as unknown as { name: string } | null
  const inviter = invite.users as unknown as { first_name: string; last_name: string } | null

  return {
    valid: true,
    status: 'pending',
    invite: {
      id: invite.id,
      dealId: invite.deal_id,
      dealName: deal?.name ?? 'Сделка',
      roleId: invite.role_id,
      roleName: role?.name ?? 'участник',
      email: invite.email,
      inviterName: inviter
        ? `${inviter.first_name ?? ''} ${inviter.last_name ?? ''}`.trim()
        : 'Владелец сделки',
    },
  }
}

// ---------------------------------------------------------------------------
// 3. ACCEPT INVITE — EXISTING ACCOUNT
// ---------------------------------------------------------------------------

export async function acceptInviteExistingAccount(token: string): Promise<AcceptResult> {
  // --- Auth check ---
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Необходимо войти в систему.' }
  }

  // --- Validate token ---
  const validation = await validateInviteToken(token)
  if (!validation.valid || !validation.invite) {
    return { success: false, error: validation.error ?? 'Приглашение недействительно.' }
  }

  const inv = validation.invite

  // --- Email binding check (case-insensitive) ---
  const userEmail = (user.email ?? '').trim().toLowerCase()
  const inviteEmail = inv.email.trim().toLowerCase()

  if (userEmail !== inviteEmail) {
    return {
      success: false,
      error: 'Это приглашение предназначено для другого адреса электронной почты.',
    }
  }

  const admin = createAdminClient()

  // --- Org-bridge safety check (MVP) ---
  // Under the current single-deal-first model, existing-account acceptance is
  // only safe when the user already belongs to the same org as the deal.
  // Cross-org acceptance would return success but leave the user without correct
  // read access (or create unsafe over-grant pressure). Fail closed.
  const { data: userProfile, error: profileLookupError } = await admin
    .from('users')
    .select('id, organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileLookupError) {
    console.error('acceptInviteExistingAccount: user profile lookup failed', profileLookupError)
    return { success: false, error: 'Ошибка проверки профиля. Попробуйте снова.' }
  }

  if (!userProfile) {
    return { success: false, error: 'Профиль пользователя не найден. Обратитесь к администратору.' }
  }

  const { data: dealData, error: dealLookupError } = await admin
    .from('deals')
    .select('organization_id')
    .eq('id', inv.dealId)
    .single()

  if (dealLookupError || !dealData?.organization_id) {
    console.error('acceptInviteExistingAccount: deal org lookup failed', dealLookupError)
    return { success: false, error: 'Не удалось определить организацию сделки. Попробуйте снова.' }
  }

  if (userProfile.organization_id !== dealData.organization_id) {
    console.error('acceptInviteExistingAccount: cross-org acceptance blocked', {
      userId: user.id,
      dealId: inv.dealId,
      userOrgId: userProfile.organization_id,
      dealOrgId: dealData.organization_id,
    })
    return {
      success: false,
      error: 'Текущий MVP не поддерживает принятие приглашения существующим аккаунтом из другой организации. Используйте новый аккаунт по приглашению или обратитесь к администратору.',
    }
  }

  // --- Idempotency: check existing membership ---
  const { data: existingMember, error: memberLookupError } = await admin
    .from('deal_members')
    .select('id')
    .eq('deal_id', inv.dealId)
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (memberLookupError) {
    console.error('acceptInviteExistingAccount: membership lookup failed', memberLookupError)
    return { success: false, error: 'Ошибка проверки участия в сделке. Попробуйте снова.' }
  }

  if (existingMember) {
    // Already a member — mark invite as accepted and succeed silently
    const { error: idempotentUpdateError } = await admin
      .from('deal_invites')
      .update({
        status: 'accepted',
        accepted_by: user.id,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', inv.id)
      .eq('status', 'pending')

    if (idempotentUpdateError) {
      console.error('acceptInviteExistingAccount: idempotent invite update failed (non-fatal)', {
        inviteId: inv.id,
        error: idempotentUpdateError.message,
      })
      // Still return success — the user IS already a member
    }

    return { success: true }
  }

  // --- Create membership ---
  // Mark invite as accepted via optimistic lock (only if still pending)
  const { data: updatedRows, error: inviteUpdateError } = await admin
    .from('deal_invites')
    .update({
      status: 'accepted',
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', inv.id)
    .eq('status', 'pending')
    .select('id')

  if (inviteUpdateError) {
    console.error('acceptInviteExistingAccount: invite status update failed', inviteUpdateError)
    return { success: false, error: 'Ошибка обновления приглашения. Попробуйте снова.' }
  }

  // Zero rows updated = another process already changed the status
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: 'Приглашение уже обработано. Обновите страницу и попробуйте снова.' }
  }

  const { error: memberError } = await admin
    .from('deal_members')
    .insert({
      deal_id: inv.dealId,
      user_id: user.id,
      role_id: inv.roleId,
    })

  if (memberError) {
    // Check if it's a duplicate constraint violation — treat as success
    if (memberError.code === '23505') {
      return { success: true }
    }

    // Revert invite status on failure
    try {
      await admin
        .from('deal_invites')
        .update({ status: 'pending', accepted_by: null, accepted_at: null })
        .eq('id', inv.id)
    } catch { /* ignore cleanup error */ }

    console.error('acceptInviteExistingAccount: membership insert failed', memberError)
    return { success: false, error: 'Ошибка создания участия в сделке. Попробуйте снова.' }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// 4. ACCEPT INVITE — NEW ACCOUNT (inline registration on /invite/[token])
// ---------------------------------------------------------------------------

export async function acceptInviteWithNewAccount(
  token: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<AcceptResult> {
  // --- Input normalization ---
  const trimmedPassword = password || ''
  const trimmedFirst = firstName?.trim() || ''
  const trimmedLast = lastName?.trim() || ''

  if (!trimmedPassword || !trimmedFirst || !trimmedLast) {
    return { success: false, error: 'Пожалуйста, заполните все обязательные поля.' }
  }

  if (trimmedPassword.length < 8) {
    return { success: false, error: 'Пароль должен содержать минимум 8 символов.' }
  }

  // --- Validate token ---
  const validation = await validateInviteToken(token)
  if (!validation.valid || !validation.invite) {
    return { success: false, error: validation.error ?? 'Приглашение недействительно.' }
  }

  const inv = validation.invite
  // Email is taken from invite (locked for MVP)
  const email = inv.email.trim().toLowerCase()

  const admin = createAdminClient()

  // --- Resolve deal's organization_id for the MVP compatibility bridge ---
  const { data: deal, error: dealError } = await admin
    .from('deals')
    .select('organization_id')
    .eq('id', inv.dealId)
    .single()

  if (dealError || !deal?.organization_id) {
    return { success: false, error: 'Ошибка: сделка не найдена или не привязана к организации.' }
  }

  // --- Phase 1: Create auth account + session ---
  const supabase = await createClient()

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: trimmedPassword,
  })

  if (signUpError) {
    if (signUpError.message.includes('already registered')) {
      return {
        success: false,
        error: 'Пользователь с таким email уже зарегистрирован. Войдите в систему и примите приглашение.',
      }
    }
    return { success: false, error: `Ошибка регистрации: ${signUpError.message}` }
  }

  const userId = signUpData.user?.id
  if (!userId) {
    return { success: false, error: 'Не удалось создать аккаунт. Попробуйте снова.' }
  }

  // Verify session (auto-confirm prerequisite)
  if (!signUpData.session) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return {
      success: false,
      error: 'Регистрация не может быть завершена: требуется подтверждение email. Обратитесь к администратору.',
    }
  }

  // --- Phase 2: Provision profile + membership (trusted server-side) ---
  let profileCreated = false
  let memberCreated = false
  let inviteMarkedAccepted = false

  try {
    // 2a. Create user profile with user_type = 'invited'
    // organization_id is set to deal's org per MVP compatibility bridge
    const { error: profileError } = await admin.from('users').insert({
      id: userId,
      organization_id: deal.organization_id,
      email,
      first_name: trimmedFirst,
      last_name: trimmedLast,
      user_type: 'invited',
    })

    if (profileError) {
      throw new Error(`Ошибка создания профиля: ${profileError.message}`)
    }
    profileCreated = true

    // 2b. Mark invite as accepted (optimistic lock)
    const { data: updatedInviteRows, error: inviteUpdateError } = await admin
      .from('deal_invites')
      .update({
        status: 'accepted',
        accepted_by: userId,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', inv.id)
      .eq('status', 'pending')
      .select('id')

    if (inviteUpdateError) {
      throw new Error(`Ошибка обновления приглашения: ${inviteUpdateError.message}`)
    }

    // Zero rows updated = concurrent acceptance already happened
    if (!updatedInviteRows || updatedInviteRows.length === 0) {
      throw new Error('Приглашение уже обработано другим процессом.')
    }
    inviteMarkedAccepted = true

    // 2c. Create deal membership
    const { error: memberError } = await admin.from('deal_members').insert({
      deal_id: inv.dealId,
      user_id: userId,
      role_id: inv.roleId,
    })

    if (memberError) {
      // Duplicate constraint → treat as success
      if (memberError.code === '23505') {
        memberCreated = true
      } else {
        throw new Error(`Ошибка привязки к сделке: ${memberError.message}`)
      }
    }
    memberCreated = true

  } catch (provisioningError) {
    // --- Compensating cleanup in reverse order ---
    console.error('Stage 7 invite acceptance provisioning failed, cleaning up:', provisioningError)

    try { if (memberCreated) await admin.from('deal_members').delete().eq('deal_id', inv.dealId).eq('user_id', userId) } catch { /* ignore */ }
    try { if (profileCreated) await admin.from('users').delete().eq('id', userId) } catch { /* ignore */ }

    // Revert invite status if we marked it
    if (inviteMarkedAccepted) {
      try {
        await admin
          .from('deal_invites')
          .update({ status: 'pending', accepted_by: null, accepted_at: null })
          .eq('id', inv.id)
      } catch { /* ignore cleanup error */ }
    }

    // Sign out stale session
    await supabase.auth.signOut().catch(() => {})

    // Delete orphaned auth user
    await admin.auth.admin.deleteUser(userId).catch(() => {})

    const errorMessage =
      provisioningError instanceof Error
        ? provisioningError.message
        : 'Ошибка создания рабочего пространства.'

    return { success: false, error: errorMessage }
  }

  return { success: true }
}
