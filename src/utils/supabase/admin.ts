import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with the service-role key for trusted
 * server-side operations (e.g., workspace provisioning during registration).
 *
 * WARNING: This client bypasses RLS. It must ONLY be used in server-side
 * code (Server Actions, API Routes, Edge Functions). Never import or
 * expose this on the client.
 *
 * The `import 'server-only'` guard above will cause a build-time error
 * if this module is accidentally imported into a client bundle.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Серверная конфигурация неполна: отсутствует SUPABASE_SERVICE_ROLE_KEY или NEXT_PUBLIC_SUPABASE_URL.'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
