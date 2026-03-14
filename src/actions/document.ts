'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getCurrentUserActiveDealContext } from '@/utils/roles'

export type DocumentActionResult = {
  success: boolean
  error?: string
  url?: string
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

const uploadDocumentSchema = z.object({
  name: z.string().trim().max(500, 'Название файла слишком длинное.').optional(),
  category: z.string().trim().max(200, 'Категория слишком длинная.').optional(),
})

const downloadDocumentSchema = z.object({
  document_id: z.string().uuid('Некорректный ID документа.'),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sanitize a filename: strip path separators, control characters,
 * and collapse to a safe substring.
 */
function sanitizeFilename(raw: string): string {
  return raw
    .replace(/[/\\]/g, '_')           // strip path separators
    .replace(/[^\w.\-а-яА-ЯёЁ ]/g, '') // keep word chars, dots, hyphens, cyrillic, spaces
    .replace(/\s+/g, '_')             // collapse whitespace to underscore
    .slice(0, 200)                     // cap length
    || 'unnamed'
}

// ---------------------------------------------------------------------------
// uploadDocumentAction
// ---------------------------------------------------------------------------

/**
 * Uploads a single file to Supabase Storage `vault` bucket and creates a
 * metadata row in `documents`.
 * 
 * Allowed roles: lead_advisor, advisor.
 * deal_id and uploaded_by are resolved server-side.
 * storage_path is generated server-side: {deal_id}/{uuid}_{sanitized_filename}
 * 
 * Fail-closed: if metadata INSERT fails after storage upload, compensating
 * delete of the uploaded object is attempted via admin client (service-role)
 * since vault bucket has no DELETE policy for authenticated users.
 */
export async function uploadDocumentAction(formData: FormData): Promise<DocumentActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Пользователь не авторизован.' }
  }

  // 1. Resolve active deal context with explicit role check
  const ctx = await getCurrentUserActiveDealContext(user.id)

  if (!ctx?.dealId) {
    return { success: false, error: 'Активная сделка не найдена.' }
  }

  if (ctx.roleName !== 'lead_advisor' && ctx.roleName !== 'advisor') {
    return { success: false, error: 'Недостаточно прав для загрузки документов.' }
  }

  // 2. Validate file
  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return { success: false, error: 'Файл не выбран.' }
  }

  if (file.size === 0) {
    return { success: false, error: 'Файл пуст. Выберите другой файл.' }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: 'Файл слишком большой. Максимум 50 МБ.' }
  }

  // Enforce exactly one file — reject if multiple file entries present
  const allFiles = formData.getAll('file')
  if (allFiles.length > 1) {
    return { success: false, error: 'Допускается загрузка только одного файла за раз.' }
  }

  // 3. Validate optional metadata with Zod
  const parsed = uploadDocumentSchema.safeParse({
    name: formData.get('name') || undefined,
    category: formData.get('category') || undefined,
  })

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Ошибка валидации.'
    return { success: false, error: firstError }
  }

  const displayName = parsed.data.name || file.name || 'unnamed'
  const category = parsed.data.category || null

  // 4. Generate storage_path server-side only
  const uuid = crypto.randomUUID()
  const sanitizedName = sanitizeFilename(file.name || 'file')
  const storagePath = `${ctx.dealId}/${uuid}_${sanitizedName}`

  // 5. Upload file to vault bucket via admin client (service-role)
  // Reason: ensures consistent storage access and enables compensating delete
  // if metadata insert fails (vault has no DELETE policy for authenticated users).
  const adminSupabase = createAdminClient()

  const { error: uploadError } = await adminSupabase.storage
    .from('vault')
    .upload(storagePath, file)

  if (uploadError) {
    console.error('uploadDocumentAction: Storage upload error', uploadError.message)
    return { success: false, error: 'Ошибка загрузки файла в хранилище. Попробуйте снова.' }
  }

  // 6. Insert metadata row into documents
  const { error: insertError } = await supabase
    .from('documents')
    .insert({
      deal_id: ctx.dealId,
      name: displayName,
      category,
      storage_path: storagePath,
      uploaded_by: user.id,
    })

  if (insertError) {
    console.error('uploadDocumentAction: DB insert error', insertError.message)

    // 7. Compensating cleanup via admin client (service-role can DELETE storage objects)
    const { error: cleanupError } = await adminSupabase.storage
      .from('vault')
      .remove([storagePath])

    if (cleanupError) {
      console.error('uploadDocumentAction: Compensating cleanup FAILED', cleanupError.message)
    } else {
      console.log('uploadDocumentAction: Compensating cleanup succeeded for', storagePath)
    }

    return { success: false, error: 'Ошибка сохранения метаданных документа. Попробуйте снова.' }
  }

  revalidatePath('/documents')
  revalidatePath('/dashboard')
  return { success: true }
}

// ---------------------------------------------------------------------------
// getDocumentDownloadUrlAction
// ---------------------------------------------------------------------------

/**
 * Generates a signed download URL for a document.
 * Available to all deal members (lead_advisor, advisor, viewer).
 * Validates same-deal ownership before URL generation.
 * TTL: 60 seconds.
 */
export async function getDocumentDownloadUrlAction(formData: FormData): Promise<DocumentActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Пользователь не авторизован.' }
  }

  // 1. Validate with Zod
  const parsed = downloadDocumentSchema.safeParse({
    document_id: formData.get('document_id'),
  })

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Некорректные параметры запроса.'
    return { success: false, error: firstError }
  }

  const { document_id: documentId } = parsed.data

  // 2. Resolve active deal context — any deal member role is sufficient for download
  const ctx = await getCurrentUserActiveDealContext(user.id)

  if (!ctx?.dealId) {
    return { success: false, error: 'Активная сделка не найдена.' }
  }

  // Any role (lead_advisor, advisor, viewer) is allowed for download

  // 3. Fetch document and verify same-deal ownership
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, deal_id, storage_path, name')
    .eq('id', documentId)
    .single()

  if (docError || !doc) {
    return { success: false, error: 'Документ не найден.' }
  }

  if (doc.deal_id !== ctx.dealId) {
    return { success: false, error: 'Документ не принадлежит текущей сделке.' }
  }

  // 4. Generate signed URL via admin client (consistent with upload path)
  const adminSupabase = createAdminClient()
  const { data: signedData, error: signedError } = await adminSupabase.storage
    .from('vault')
    .createSignedUrl(doc.storage_path, 60)

  if (signedError || !signedData?.signedUrl) {
    console.error('getDocumentDownloadUrlAction: Signed URL error', signedError?.message)
    return { success: false, error: 'Ошибка генерации ссылки для скачивания.' }
  }

  return { success: true, url: signedData.signedUrl }
}

// ---------------------------------------------------------------------------
// toggleDocumentExternalAction
// ---------------------------------------------------------------------------

/**
 * Toggles a document's is_external flag (true↔false).
 * Only lead_advisor of the document's deal may call this.
 * Uses normal client (RLS UPDATE policy permits lead_advisor).
 */
export async function toggleDocumentExternalAction(
  documentId: string
): Promise<DocumentActionResult> {
  // 1. Validate
  const parsed = downloadDocumentSchema.safeParse({ document_id: documentId })
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Некорректные параметры.'
    return { success: false, error: firstError }
  }

  const validDocId = parsed.data.document_id

  // 2. Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Пользователь не авторизован.' }
  }

  // 3. Role check: lead_advisor only
  const ctx = await getCurrentUserActiveDealContext(user.id)

  if (!ctx?.dealId) {
    return { success: false, error: 'Активная сделка не найдена.' }
  }

  if (ctx.roleName !== 'lead_advisor') {
    return { success: false, error: 'Только ведущий консультант может изменять внешнюю доступность.' }
  }

  // 4. Fetch document and verify same-deal ownership
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, deal_id, is_external')
    .eq('id', validDocId)
    .single()

  if (docError || !doc) {
    return { success: false, error: 'Документ не найден.' }
  }

  if (doc.deal_id !== ctx.dealId) {
    return { success: false, error: 'Документ не принадлежит текущей сделке.' }
  }

  // 5. Toggle is_external
  const newValue = !doc.is_external

  const { error: updateError } = await supabase
    .from('documents')
    .update({ is_external: newValue })
    .eq('id', validDocId)
    .eq('deal_id', ctx.dealId)

  if (updateError) {
    console.error('toggleDocumentExternalAction: update failed', updateError.message)
    return { success: false, error: 'Ошибка обновления. Попробуйте снова.' }
  }

  revalidatePath('/documents')
  return { success: true }
}
