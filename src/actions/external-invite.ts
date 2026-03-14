'use server'

import { randomBytes } from 'crypto'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUserActiveDealContext } from '@/utils/roles'

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
// Zod Schemas
// ---------------------------------------------------------------------------

const createExternalInviteSchema = z.object({
  dealId: z.string().uuid('Некорректный ID сделки.'),
  inviteeEmail: z.string().email('Некорректный email-адрес.'),
})

const acceptExternalInviteSchema = z.object({
  token: z.string().trim().min(1, 'Токен обязателен.').max(256, 'Токен слишком длинный.'),
  password: z.string().min(8, 'Пароль должен содержать минимум 8 символов.').optional(),
  firstName: z.string().trim().min(1, 'Укажите имя.').optional(),
  lastName: z.string().trim().min(1, 'Укажите фамилию.').optional(),
})

const revokeExternalAccessSchema = z.object({
  externalAccessId: z.string().uuid('Некорректный ID доступа.'),
  dealId: z.string().uuid('Некорректный ID сделки.'),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSiteOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SITE_URL
  if (!url) return null
  return url.replace(/\/+$/, '')
}

/**
 * Verifies the calling user is lead_advisor for the exact dealId.
 * Uses getCurrentUserActiveDealContext to resolve through org → deal → role.
 */
async function verifyLeadAdvisorForDeal(
  userId: string,
  dealId: string
): Promise<{ authorized: true } | { authorized: false; error: string }> {
  const ctx = await getCurrentUserActiveDealContext(userId)

  if (!ctx || !ctx.dealId) {
    return { authorized: false, error: 'Активная сделка не найдена.' }
  }

  if (ctx.dealId !== dealId) {
    return { authorized: false, error: 'Указанная сделка не соответствует вашей активной сделке.' }
  }

  if (ctx.roleName !== 'lead_advisor') {
    return { authorized: false, error: 'Только lead_advisor сделки может выполнить это действие.' }
  }

  return { authorized: true }
}

/**
 * Trust-purity guard: checks that a user does NOT have internal trust markers.
 * Returns true if the user is "pure external" (safe to grant external access).
 * Returns false if the user has internal org membership or deal_members presence.
 */
async function isExternalPure(userId: string): Promise<boolean> {
  const admin = createAdminClient()

  // Check 1: user must not have a non-null organization_id
  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('organization_id, user_type')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    console.error('isExternalPure: profile lookup failed', profileError)
    return false // fail closed
  }

  if (!profile) {
    return false // no profile = fail closed
  }

  if (profile.organization_id !== null) {
    return false // has internal org membership
  }

  // Check 2: user must not be in deal_members at all
  const { data: memberRow, error: memberError } = await admin
    .from('deal_members')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (memberError) {
    console.error('isExternalPure: deal_members lookup failed', memberError)
    return false // fail closed
  }

  if (memberRow) {
    return false // has internal deal membership
  }

  return true
}

/**
 * Cleanup a just-created auth user + profile.
 * Only call this for newly created users within the accept flow.
 */
async function cleanupNewExternalUser(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<void> {
  const admin = createAdminClient()
  try { await admin.from('users').delete().eq('id', userId) } catch { /* ignore */ }
  try { await supabase.auth.signOut() } catch { /* ignore */ }
  try { await admin.auth.admin.deleteUser(userId) } catch { /* ignore */ }
}

/**
 * Convenience: cleanup newly created user (if applicable) and return an error result.
 * Avoids repeating the if-new-cleanup pattern on every failure branch.
 */
async function failWithCleanup(
  error: string,
  isNewlyCreated: boolean,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<ExternalInviteResult> {
  if (isNewlyCreated) {
    await cleanupNewExternalUser(userId, supabase)
  }
  return { success: false, error }
}

/**
 * Checks if a target email already belongs to an internal principal.
 * Returns true if the email is internal (has org or deal_members presence).
 * Returns false if no profile exists or the profile is pure-external.
 */
async function isInternalEmail(email: string): Promise<boolean> {
  const admin = createAdminClient()

  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('id, organization_id')
    .eq('email', email)
    .limit(1)
    .maybeSingle()

  if (profileError || !profile) {
    return false // no profile = not internal (or fail open for invite creation)
  }

  // Internal if has org membership
  if (profile.organization_id !== null) {
    return true
  }

  // Internal if has deal_members presence
  const { data: memberRow, error: memberError } = await admin
    .from('deal_members')
    .select('id')
    .eq('user_id', profile.id)
    .limit(1)
    .maybeSingle()

  if (memberError) {
    return false // fail open for invite creation (acceptance will re-check)
  }

  return !!memberRow
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
  // --- Zod validation ---
  const parsed = createExternalInviteSchema.safeParse({ dealId, inviteeEmail })
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Ошибка валидации.'
    return { success: false, error: firstError }
  }

  const email = parsed.data.inviteeEmail.trim().toLowerCase()
  const validDealId = parsed.data.dealId

  // --- Auth check ---
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Необходимо войти в систему.' }
  }

  // --- Site origin check ---
  const siteOrigin = getSiteOrigin()
  if (!siteOrigin) {
    return {
      success: false,
      error: 'Серверная конфигурация неполна: не задан NEXT_PUBLIC_SITE_URL.',
    }
  }

  // --- Authority check: caller must be lead_advisor for this exact deal ---
  const authResult = await verifyLeadAdvisorForDeal(user.id, validDealId)
  if (!authResult.authorized) {
    return { success: false, error: authResult.error }
  }

  // --- Fail-fast: reject invites to already-internal principals ---
  const emailIsInternal = await isInternalEmail(email)
  if (emailIsInternal) {
    return {
      success: false,
      error: 'Этот email уже принадлежит внутреннему пользователю. Для внешнего доступа необходимо использовать другой email.',
    }
  }

  const admin = createAdminClient()

  // --- Check for existing pending external invite ---
  const { data: existingInvite, error: lookupError } = await admin
    .from('external_invites')
    .select('id, token, expires_at')
    .eq('deal_id', validDealId)
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
      deal_id: validDealId,
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
        .eq('deal_id', validDealId)
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
 *
 * Trust purity: rejects users who already have internal trust markers
 * (organization_id or deal_members presence).
 */
export async function acceptExternalInvite(
  token: string,
  password?: string,
  firstName?: string,
  lastName?: string
): Promise<ExternalInviteResult> {
  // --- Zod validation ---
  const parsed = acceptExternalInviteSchema.safeParse({ token, password, firstName, lastName })
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Ошибка валидации.'
    return { success: false, error: firstError }
  }

  const validToken = parsed.data.token

  const admin = createAdminClient()

  // --- Fetch invite ---
  const { data: invite, error: inviteError } = await admin
    .from('external_invites')
    .select('id, deal_id, email, status, expires_at, invited_by')
    .eq('token', validToken)
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
  let isNewlyCreatedUser = false

  // --- Determine if this is a new or existing user ---
  const { data: { user: existingUser } } = await supabase.auth.getUser()

  if (existingUser) {
    // Existing authenticated user — verify email binding
    const userEmail = (existingUser.email ?? '').trim().toLowerCase()
    if (userEmail !== email) {
      return { success: false, error: 'Это приглашение предназначено для другого email-адреса.' }
    }
    userId = existingUser.id
  } else if (parsed.data.password && parsed.data.firstName && parsed.data.lastName) {
    // New account registration (inline)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: parsed.data.password,
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
      first_name: parsed.data.firstName.trim(),
      last_name: parsed.data.lastName.trim(),
      user_type: 'external',
    })

    if (profileError) {
      await cleanupNewExternalUser(userId, supabase)
      return { success: false, error: 'Ошибка создания профиля.' }
    }

    isNewlyCreatedUser = true
  } else {
    return { success: false, error: 'Необходимо войти в систему или заполнить регистрационные данные.' }
  }

  // --- Trust purity guard ---
  // External principals must not simultaneously carry internal trust semantics.
  const isPure = await isExternalPure(userId!)
  if (!isPure) {
    if (isNewlyCreatedUser) {
      await cleanupNewExternalUser(userId!, supabase)
    }
    return {
      success: false,
      error: 'Для внешнего доступа необходимо использовать отдельный внешний аккаунт. Этот аккаунт уже связан с внутренней организацией или сделкой.',
    }
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
    return await failWithCleanup('Ошибка проверки доступа.', isNewlyCreatedUser, userId!, supabase)
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
    return await failWithCleanup('Ошибка обновления приглашения.', isNewlyCreatedUser, userId!, supabase)
  }

  if (!updatedRows || updatedRows.length === 0) {
    return await failWithCleanup('Приглашение уже обработано.', isNewlyCreatedUser, userId!, supabase)
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
    return await failWithCleanup('Ошибка создания внешнего доступа.', isNewlyCreatedUser, userId!, supabase)
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
  // --- Zod validation ---
  const parsed = revokeExternalAccessSchema.safeParse({ externalAccessId, dealId })
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Ошибка валидации.'
    return { success: false, error: firstError }
  }

  const validAccessId = parsed.data.externalAccessId
  const validDealId = parsed.data.dealId

  // --- Auth check ---
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Необходимо войти в систему.' }
  }

  // --- Authority check: caller must be lead_advisor for this exact deal ---
  const authResult = await verifyLeadAdvisorForDeal(user.id, validDealId)
  if (!authResult.authorized) {
    return { success: false, error: authResult.error }
  }

  const admin = createAdminClient()

  const { data: updated, error: updateError } = await admin
    .from('external_access')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: user.id,
    })
    .eq('id', validAccessId)
    .eq('deal_id', validDealId)
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
