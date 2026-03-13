'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

interface RegistrationResult {
  success: boolean
  error?: string
}

/**
 * Stage 6: Seller-only self-registration.
 *
 * Two-phase orchestration:
 *   Phase 1 — Auth account + session via normal signUp() (request context)
 *   Phase 2 — Workspace provisioning via service-role admin client (trusted)
 *
 * Partial-failure handling: if Phase 2 fails after Phase 1 succeeds,
 * we clean up all created downstream records in reverse dependency order
 * plus the orphaned auth user and sign out the stale session.
 */
export async function registerSeller(formData: FormData): Promise<RegistrationResult> {
  // --- Input normalization ---
  const email = (formData.get('email') as string)?.trim() || ''
  const password = formData.get('password') as string || ''
  const firstName = (formData.get('first_name') as string)?.trim() || ''
  const lastName = (formData.get('last_name') as string)?.trim() || ''
  const organizationName = (formData.get('organization_name') as string)?.trim() || ''
  const jobTitle = (formData.get('job_title') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null

  // --- Validation ---
  if (!email || !password || !firstName || !lastName || !organizationName) {
    return { success: false, error: 'Пожалуйста, заполните все обязательные поля.' }
  }

  if (password.length < 8) {
    return { success: false, error: 'Пароль должен содержать минимум 8 символов.' }
  }

  // --- Phase 1: Auth account + browser session ---
  const supabase = await createClient()

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (signUpError) {
    if (signUpError.message.includes('already registered')) {
      return { success: false, error: 'Пользователь с таким email уже зарегистрирован.' }
    }
    return { success: false, error: `Ошибка регистрации: ${signUpError.message}` }
  }

  const userId = signUpData.user?.id
  if (!userId) {
    return { success: false, error: 'Не удалось создать аккаунт. Попробуйте снова.' }
  }

  // Verify that signUp returned an active session (auto-confirm prerequisite)
  if (!signUpData.session) {
    // Email confirmation is still enabled — this violates the MVP prerequisite.
    // Clean up the auth user we just created and report clearly.
    const admin = createAdminClient()
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return {
      success: false,
      error: 'Регистрация не может быть завершена: требуется подтверждение email. Обратитесь к администратору.',
    }
  }

  // --- Phase 2: Workspace provisioning (trusted server-side only) ---
  const admin = createAdminClient()

  // Track created resource IDs for compensating cleanup on failure
  let orgId: string | null = null
  let dealId: string | null = null
  let profileCreated = false
  let stagesCreated = false
  let memberCreated = false

  try {
    // 2a. Create organization
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({ name: organizationName })
      .select('id')
      .single()

    if (orgError || !org) {
      throw new Error(`Ошибка создания организации: ${orgError?.message}`)
    }
    orgId = org.id

    // 2b. Create user profile in public.users
    const { error: profileError } = await admin.from('users').insert({
      id: userId,
      organization_id: org.id,
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
      job_title: jobTitle,
      user_type: 'seller',
    })

    if (profileError) {
      throw new Error(`Ошибка создания профиля: ${profileError.message}`)
    }
    profileCreated = true

    // 2c. Create default deal
    const { data: deal, error: dealError } = await admin
      .from('deals')
      .insert({
        organization_id: org.id,
        name: 'Новая сделка',
        description: '',
      })
      .select('id')
      .single()

    if (dealError || !deal) {
      throw new Error(`Ошибка создания сделки: ${dealError?.message}`)
    }
    dealId = deal.id

    // 2d. Create canonical 8 pipeline stages (deal-scoped)
    const stages = [
      { deal_id: deal.id, name: 'Подготовка', sort_order: 1 },
      { deal_id: deal.id, name: 'Тизер', sort_order: 2 },
      { deal_id: deal.id, name: 'NDA', sort_order: 3 },
      { deal_id: deal.id, name: 'CIM', sort_order: 4 },
      { deal_id: deal.id, name: 'Встречи', sort_order: 5 },
      { deal_id: deal.id, name: 'LOI/IOI', sort_order: 6 },
      { deal_id: deal.id, name: 'Внутренний DD', sort_order: 7 },
      { deal_id: deal.id, name: 'Закрытие', sort_order: 8 },
    ]

    const { error: stagesError } = await admin
      .from('pipeline_stages')
      .insert(stages)

    if (stagesError) {
      throw new Error(`Ошибка создания этапов воронки: ${stagesError.message}`)
    }
    stagesCreated = true

    // 2e. Resolve deal_roles: reuse lead_advisor if present, create if absent
    const { data: existingRole, error: roleLookupError } = await admin
      .from('deal_roles')
      .select('id')
      .eq('name', 'lead_advisor')
      .limit(1)
      .maybeSingle()

    if (roleLookupError) {
      throw new Error(`Ошибка поиска роли: ${roleLookupError.message}`)
    }

    let roleId: string
    if (existingRole) {
      roleId = existingRole.id
    } else {
      const { data: newRole, error: roleError } = await admin
        .from('deal_roles')
        .insert({ name: 'lead_advisor', description: 'Ведущий консультант сделки' })
        .select('id')
        .single()

      if (roleError || !newRole) {
        throw new Error(`Ошибка создания роли: ${roleError?.message}`)
      }
      roleId = newRole.id
    }

    // 2f. Create deal membership
    const { error: memberError } = await admin.from('deal_members').insert({
      deal_id: deal.id,
      user_id: userId,
      role_id: roleId,
    })

    if (memberError) {
      throw new Error(`Ошибка привязки к сделке: ${memberError.message}`)
    }
    memberCreated = true

  } catch (provisioningError) {
    // --- Compensating cleanup: reverse dependency order ---
    console.error('Stage 6 provisioning failed, cleaning up:', provisioningError)

    // Clean up in reverse order, ignoring individual cleanup errors
    try { if (memberCreated && dealId) await admin.from('deal_members').delete().eq('deal_id', dealId).eq('user_id', userId) } catch { /* ignore */ }
    try { if (stagesCreated && dealId) await admin.from('pipeline_stages').delete().eq('deal_id', dealId) } catch { /* ignore */ }
    try { if (dealId) await admin.from('deals').delete().eq('id', dealId) } catch { /* ignore */ }
    try { if (profileCreated) await admin.from('users').delete().eq('id', userId) } catch { /* ignore */ }
    try { if (orgId) await admin.from('organizations').delete().eq('id', orgId) } catch { /* ignore */ }

    // Sign out stale session from Phase 1
    await supabase.auth.signOut().catch(() => {})

    // Delete the orphaned auth user
    await admin.auth.admin.deleteUser(userId).catch(() => {})

    const errorMessage =
      provisioningError instanceof Error
        ? provisioningError.message
        : 'Ошибка создания рабочего пространства.'

    return { success: false, error: errorMessage }
  }

  // --- Success: return clean result (client handles navigation) ---
  return { success: true }
}
