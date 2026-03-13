'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUserActiveDealContext } from '@/utils/roles'

export type CommunicationActionResult = {
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const ALLOWED_COMM_TYPES = ['Email', 'Call', 'Meeting', 'Note'] as const

const createCommunicationSchema = z.object({
  buyer_id: z.string().uuid('Некорректный ID покупателя.'),
  type: z.enum(ALLOWED_COMM_TYPES, {
    message: 'Тип коммуникации должен быть: Email, Call, Meeting или Note.',
  }),
  content: z
    .string()
    .trim()
    .min(1, 'Содержание записи обязательно.')
    .max(5000, 'Содержание слишком длинное (максимум 5000 символов).'),
  date: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
      'Некорректный формат даты. Используйте поле выбора даты.'
    )
    .transform((val) => new Date(val))
    .refine((d) => !isNaN(d.getTime()), {
      message: 'Некорректная дата. Выберите дату из календаря.',
    }),
})

// ---------------------------------------------------------------------------
// createCommunicationAction
// ---------------------------------------------------------------------------

/**
 * Creates a communication log entry tied to a buyer in the active deal.
 * MUST verify same-deal buyer ownership before insert.
 * Allowed roles: lead_advisor, advisor.
 * logged_by is resolved server-side.
 * date is validated via z.coerce.date() and written as TIMESTAMPTZ.
 */
export async function createCommunicationAction(formData: FormData): Promise<CommunicationActionResult> {
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
    return { success: false, error: 'Недостаточно прав для добавления записей коммуникации.' }
  }

  // 2. Validate with Zod
  const parsed = createCommunicationSchema.safeParse({
    buyer_id: formData.get('buyer_id'),
    type: formData.get('type'),
    content: formData.get('content'),
    date: formData.get('date'),
  })

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Ошибка валидации.'
    return { success: false, error: firstError }
  }

  const { buyer_id: buyerId, type, content, date } = parsed.data

  // 3. Same-Deal Integrity: verify buyer belongs to the active deal
  const { data: buyer, error: buyerError } = await supabase
    .from('buyers')
    .select('id, deal_id')
    .eq('id', buyerId)
    .single()

  if (buyerError || !buyer) {
    return { success: false, error: 'Покупатель не найден.' }
  }

  if (buyer.deal_id !== ctx.dealId) {
    return { success: false, error: 'Выбранный покупатель не принадлежит текущей сделке.' }
  }

  // 4. Insert communication
  const { error } = await supabase
    .from('communications')
    .insert({
      buyer_id: buyerId,
      logged_by: user.id,
      type,
      content,
      date: date.toISOString(),
    })

  if (error) {
    console.error('createCommunicationAction: DB error', error.message)
    return { success: false, error: 'Ошибка создания записи. Попробуйте снова.' }
  }

  revalidatePath('/communications')
  revalidatePath('/dashboard')
  return { success: true }
}
