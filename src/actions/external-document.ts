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
 * Requirements:
 *  1. Caller must be authenticated
 *  2. Document must exist
 *  3. Document must have is_external = true
 *  4. Caller must have an active (non-revoked) external_access row
 *     for the document's deal_id
 */
export async function getExternalDocumentDownloadUrlAction(
  formData: FormData
): Promise<ExternalDocumentActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
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
    return { success: false, error: 'Документ не найден.' }
  }

  // 3. Verify document is externally allowlisted
  if (!doc.is_external) {
    return { success: false, error: 'Документ не найден.' }
  }

  // 4. Verify caller has active external access for this deal
  const { data: access, error: accessError } = await admin
    .from('external_access')
    .select('id')
    .eq('deal_id', doc.deal_id)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle()

  if (accessError || !access) {
    return { success: false, error: 'У вас нет доступа к этому документу.' }
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
