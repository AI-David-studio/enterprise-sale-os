'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExternalDocumentActionResult = {
  success: boolean
  error?: string
  url?: string
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const externalDownloadSchema = z.object({
  document_id: z.string().uuid('Некорректный ID документа.'),
})

// Opaque error for all unauthorized / not-found conditions.
// Avoids document-existence oracle for external principals.
const OPAQUE_NOT_FOUND = 'Документ не найден.'

// ---------------------------------------------------------------------------
// getExternalDocumentDownloadUrlAction
// ---------------------------------------------------------------------------

/**
 * Generates a signed download URL for an external-facing document.
 *
 * Authorization is based on external_access semantics ONLY.
 * Does NOT use getCurrentUserActiveDealContext.
 * Does NOT depend on deal_members or organization membership.
 *
 * All unauthorized/missing/non-external paths return the same opaque
 * "not found" error to prevent document-ID existence oracles.
 */
export async function getExternalDocumentDownloadUrlAction(
  formData: FormData
): Promise<ExternalDocumentActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Необходимо войти в систему.' }
  }

  // 1. Validate input
  const parsed = externalDownloadSchema.safeParse({
    document_id: formData.get('document_id'),
  })

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Некорректные параметры запроса.'
    return { success: false, error: firstError }
  }

  const { document_id: documentId } = parsed.data
  const admin = createAdminClient()

  // 2. Fetch document via admin client (bypass RLS for authorization check)
  const { data: doc, error: docError } = await admin
    .from('documents')
    .select('id, deal_id, storage_path, name, is_external')
    .eq('id', documentId)
    .single()

  if (docError || !doc) {
    return { success: false, error: OPAQUE_NOT_FOUND }
  }

  // 3. Verify document is externally allowlisted
  if (!doc.is_external) {
    return { success: false, error: OPAQUE_NOT_FOUND }
  }

  // 4. Verify caller has exactly 1 active external access for this deal
  //    Fetch up to 2 rows — if count !== 1, fail closed.
  const { data: accessRows, error: accessError } = await admin
    .from('external_access')
    .select('id')
    .eq('deal_id', doc.deal_id)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .limit(2)

  if (accessError || !accessRows || accessRows.length !== 1) {
    return { success: false, error: OPAQUE_NOT_FOUND }
  }

  // 5. Generate signed URL via admin client
  const { data: signedData, error: signedError } = await admin.storage
    .from('vault')
    .createSignedUrl(doc.storage_path, 60)

  if (signedError || !signedData?.signedUrl) {
    console.error('getExternalDocumentDownloadUrlAction: Signed URL error', signedError?.message)
    return { success: false, error: 'Ошибка генерации ссылки для скачивания.' }
  }

  return { success: true, url: signedData.signedUrl }
}
