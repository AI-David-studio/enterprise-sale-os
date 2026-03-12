import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'

/**
 * Resolves the current user's deal role name for a specific deal.
 * Returns the role name (e.g. 'lead_advisor', 'advisor', 'viewer') or null.
 * Uses the admin client to bypass RLS for reliable server-side lookups.
 *
 * Returns null if the user is not a member of the deal.
 * Throws on actual DB query failures to avoid masking backend problems.
 */
export async function getUserDealRole(
  userId: string,
  dealId: string
): Promise<string | null> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('deal_members')
    .select('role_id, deal_roles(name)')
    .eq('deal_id', dealId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('getUserDealRole: DB query failed', { userId, dealId, error: error.message })
    throw new Error(`Ошибка проверки роли пользователя: ${error.message}`)
  }

  if (!data) return null

  // Supabase returns the joined table as an object
  const role = data.deal_roles as unknown as { name: string } | null
  return role?.name ?? null
}

/**
 * Checks whether the given user is the deal owner (lead_advisor role).
 * Throws on DB query failures.
 */
export async function isDealOwner(
  userId: string,
  dealId: string
): Promise<boolean> {
  const roleName = await getUserDealRole(userId, dealId)
  return roleName === 'lead_advisor'
}

/**
 * Resolves a deal_roles.id by name. Returns the UUID or null if not found.
 * Throws on actual DB query failures.
 */
export async function getRoleIdByName(
  roleName: string
): Promise<string | null> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('deal_roles')
    .select('id')
    .eq('name', roleName)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('getRoleIdByName: DB query failed', { roleName, error: error.message })
    throw new Error(`Ошибка поиска роли: ${error.message}`)
  }

  return data?.id ?? null
}

/**
 * Resolves the current user's role for their organization's active deal.
 * Returns the role name (e.g. 'lead_advisor', 'advisor', 'viewer') or null
 * if the user has no profile, no org deal, or no membership.
 *
 * Does NOT throw — returns null on any failure and logs the error.
 * Safe for use in layout/guards where crashes must be avoided.
 */
export async function getCurrentUserActiveDealRole(
  userId: string
): Promise<string | null> {
  try {
    const admin = createAdminClient()

    // 1. Get user's organization
    const { data: profile, error: profileError } = await admin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('getCurrentUserActiveDealRole: profile lookup failed', profileError)
      return null
    }
    if (!profile?.organization_id) return null

    // 2. Get org's active deal (single-deal MVP)
    const { data: deal, error: dealError } = await admin
      .from('deals')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .limit(1)
      .maybeSingle()

    if (dealError) {
      console.error('getCurrentUserActiveDealRole: deal lookup failed', dealError)
      return null
    }
    if (!deal?.id) return null

    // 3. Resolve membership role
    return await getUserDealRole(userId, deal.id)
  } catch (err) {
    console.error('getCurrentUserActiveDealRole: unexpected error', err)
    return null
  }
}

