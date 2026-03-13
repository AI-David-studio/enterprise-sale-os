'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUserActiveDealContext } from '@/utils/roles'

export type BuyerActionResult = {
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const createBuyerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Название покупателя обязательно.')
    .max(255, 'Название покупателя слишком длинное (максимум 255 символов).'),
  industry: z.string().trim().optional().default(''),
  website: z.string().trim().optional().default(''),
  description: z.string().trim().optional().default(''),
})

const moveBuyerStageSchema = z.object({
  buyer_id: z.string().uuid('Некорректный ID покупателя.'),
  new_stage_id: z.string().uuid('Некорректный ID этапа.'),
})

// ---------------------------------------------------------------------------
// createBuyerAction
// ---------------------------------------------------------------------------

/**
 * Creates a new buyer for the active deal.
 * Atomically creates the initial buyer_pipeline_states row
 * using the pipeline_stages entry with the lowest sort_order.
 *
 * FAIL-CLOSED: If initial pipeline state cannot be created,
 * the buyer row is rolled back via compensating delete.
 */
export async function createBuyerAction(formData: FormData): Promise<BuyerActionResult> {
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
    return { success: false, error: 'Только Lead Advisor может добавлять покупателей.' }
  }

  // 2. Validate with Zod
  const parsed = createBuyerSchema.safeParse({
    name: formData.get('name'),
    industry: formData.get('industry'),
    website: formData.get('website'),
    description: formData.get('description'),
  })

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Ошибка валидации.'
    return { success: false, error: firstError }
  }

  const { name, industry, website, description } = parsed.data

  // 3. Resolve the initial pipeline stage (lowest sort_order for this deal)
  const { data: initialStage, error: stageError } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('deal_id', ctx.dealId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (stageError) {
    console.error('createBuyerAction: failed to resolve initial stage', stageError.message)
    return { success: false, error: 'Ошибка загрузки этапов воронки.' }
  }

  if (!initialStage) {
    return { success: false, error: 'Этапы воронки не настроены для этой сделки. Обратитесь к администратору.' }
  }

  // 4. Create the buyer
  const { data: newBuyer, error: buyerError } = await supabase
    .from('buyers')
    .insert({
      deal_id: ctx.dealId,
      name,
      industry: industry || null,
      website: website || null,
      description: description || null,
    })
    .select('id')
    .single()

  if (buyerError || !newBuyer) {
    console.error('createBuyerAction: buyer insert failed', buyerError?.message)
    return { success: false, error: 'Ошибка создания покупателя. Попробуйте снова.' }
  }

  // 5. Create the initial pipeline state (FAIL-CLOSED with compensating rollback)
  const { error: pipelineError } = await supabase
    .from('buyer_pipeline_states')
    .insert({
      buyer_id: newBuyer.id,
      stage_id: initialStage.id,
    })

  if (pipelineError) {
    console.error('createBuyerAction: initial pipeline state insert failed', pipelineError.message)

    // Compensating rollback: delete the just-created buyer
    const { error: rollbackError } = await supabase
      .from('buyers')
      .delete()
      .eq('id', newBuyer.id)

    if (rollbackError) {
      console.error('createBuyerAction: compensating rollback failed', rollbackError.message)
    }

    return { success: false, error: 'Ошибка привязки начального этапа воронки. Покупатель не создан.' }
  }

  revalidatePath('/buyers')
  revalidatePath('/dashboard')
  return { success: true }
}

// ---------------------------------------------------------------------------
// moveBuyerStageAction
// ---------------------------------------------------------------------------

/**
 * Moves a buyer to a different pipeline stage.
 * Validates that the target stage belongs to the same deal.
 * Returns error if no pipeline-state row exists or zero rows updated.
 */
export async function moveBuyerStageAction(formData: FormData): Promise<BuyerActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Пользователь не авторизован.' }
  }

  // 1. Validate with Zod
  const parsed = moveBuyerStageSchema.safeParse({
    buyer_id: formData.get('buyer_id'),
    new_stage_id: formData.get('new_stage_id'),
  })

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Некорректные параметры запроса.'
    return { success: false, error: firstError }
  }

  const { buyer_id: buyerId, new_stage_id: newStageId } = parsed.data

  // 2. Resolve the buyer's deal
  const { data: buyer, error: buyerError } = await supabase
    .from('buyers')
    .select('id, deal_id')
    .eq('id', buyerId)
    .single()

  if (buyerError || !buyer) {
    return { success: false, error: 'Покупатель не найден.' }
  }

  // 3. Explicit authorization: lead_advisor for THIS deal
  const ctx = await getCurrentUserActiveDealContext(user.id)

  if (!ctx?.dealId || ctx.dealId !== buyer.deal_id) {
    return { success: false, error: 'Нет доступа к этой сделке.' }
  }

  if (ctx.roleName !== 'lead_advisor') {
    return { success: false, error: 'Только Lead Advisor может менять этап воронки.' }
  }

  // 4. Validate the target stage belongs to the same deal
  const { data: targetStage, error: stageError } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('id', newStageId)
    .eq('deal_id', buyer.deal_id)
    .single()

  if (stageError || !targetStage) {
    return { success: false, error: 'Выбранный этап не принадлежит этой сделке.' }
  }

  // 5. Verify current pipeline-state row exists before updating
  const { data: currentState, error: currentError } = await supabase
    .from('buyer_pipeline_states')
    .select('id')
    .eq('buyer_id', buyerId)
    .single()

  if (currentError || !currentState) {
    return { success: false, error: 'Состояние воронки для покупателя отсутствует или повреждено.' }
  }

  // 6. Update the pipeline state and verify exactly one row was affected
  const { data: updated, error: updateError } = await supabase
    .from('buyer_pipeline_states')
    .update({ stage_id: newStageId })
    .eq('id', currentState.id)
    .select('id')

  if (updateError) {
    console.error('moveBuyerStageAction: update failed', updateError.message)
    return { success: false, error: 'Ошибка обновления этапа. Попробуйте снова.' }
  }

  if (!updated || updated.length === 0) {
    return { success: false, error: 'Обновление этапа не было применено. Повторите попытку.' }
  }

  revalidatePath(`/buyers/${buyerId}`)
  revalidatePath('/buyers')
  revalidatePath('/dashboard')
  return { success: true }
}
