'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUserActiveDealContext } from '@/utils/roles'

export type DealActionResult = {
  success: boolean
  error?: string
}

const updateDealSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Название проекта обязательно.')
    .max(255, 'Название проекта слишком длинное (максимум 255 символов).'),
  description: z.string().trim().optional().default(''),
  target_industry: z.string().trim().optional().default(''),
})

export async function updateDealAction(formData: FormData): Promise<DealActionResult> {
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

  if (ctx.roleName !== 'lead_advisor') {
    return { success: false, error: 'Только Lead Advisor может редактировать настройки сделки.' }
  }

  // 2. Validate with Zod
  const parsed = updateDealSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    target_industry: formData.get('target_industry'),
  })

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Ошибка валидации.'
    return { success: false, error: firstError }
  }

  const { name, description, target_industry } = parsed.data

  // 3. Perform the update (RLS acts as fail-closed backstop)
  const { error } = await supabase
    .from('deals')
    .update({
      name,
      description: description || null,
      target_industry: target_industry || null,
    })
    .eq('id', ctx.dealId)

  if (error) {
    console.error('updateDealAction: DB error', error.message)
    return { success: false, error: 'Ошибка сохранения. Попробуйте снова.' }
  }

  revalidatePath('/deal')
  revalidatePath('/dashboard')
  return { success: true }
}
