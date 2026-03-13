'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUserActiveDealContext } from '@/utils/roles'

export type TaskActionResult = {
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Название задачи обязательно.')
    .max(500, 'Название задачи слишком длинное (максимум 500 символов).'),
  description: z.string().trim().optional().default(''),
})

const toggleTaskStatusSchema = z.object({
  task_id: z.string().uuid('Некорректный ID задачи.'),
})

// ---------------------------------------------------------------------------
// createTaskAction
// ---------------------------------------------------------------------------

/**
 * Creates a new task for the active deal.
 * Allowed roles: lead_advisor, advisor.
 * deal_id and created_by are resolved server-side.
 * Default status: 'pending'.
 */
export async function createTaskAction(formData: FormData): Promise<TaskActionResult> {
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
    return { success: false, error: 'Недостаточно прав для создания задач.' }
  }

  // 2. Validate with Zod
  const parsed = createTaskSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
  })

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Ошибка валидации.'
    return { success: false, error: firstError }
  }

  const { title, description } = parsed.data

  // 3. Insert task
  const { error } = await supabase
    .from('tasks')
    .insert({
      deal_id: ctx.dealId,
      created_by: user.id,
      title,
      description: description || null,
      status: 'pending',
    })

  if (error) {
    console.error('createTaskAction: DB error', error.message)
    return { success: false, error: 'Ошибка создания задачи. Попробуйте снова.' }
  }

  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  return { success: true }
}

// ---------------------------------------------------------------------------
// toggleTaskStatusAction
// ---------------------------------------------------------------------------

/**
 * Toggles a task status strictly between 'pending' and 'completed'.
 * MUST verify same-deal ownership before mutation.
 * Fails safely on unexpected status values.
 * Allowed roles: lead_advisor, advisor.
 */
export async function toggleTaskStatusAction(formData: FormData): Promise<TaskActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Пользователь не авторизован.' }
  }

  // 1. Validate with Zod
  const parsed = toggleTaskStatusSchema.safeParse({
    task_id: formData.get('task_id'),
  })

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Некорректные параметры запроса.'
    return { success: false, error: firstError }
  }

  const { task_id: taskId } = parsed.data

  // 2. Resolve active deal context with explicit role check
  const ctx = await getCurrentUserActiveDealContext(user.id)

  if (!ctx?.dealId) {
    return { success: false, error: 'Активная сделка не найдена.' }
  }

  if (ctx.roleName !== 'lead_advisor' && ctx.roleName !== 'advisor') {
    return { success: false, error: 'Недостаточно прав для изменения статуса задач.' }
  }

  // 3. Fetch the task and verify same-deal ownership
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, status, deal_id')
    .eq('id', taskId)
    .single()

  if (taskError || !task) {
    return { success: false, error: 'Задача не найдена.' }
  }

  if (task.deal_id !== ctx.dealId) {
    return { success: false, error: 'Задача не принадлежит текущей сделке.' }
  }

  // 4. Validate current status and compute new status
  if (task.status !== 'pending' && task.status !== 'completed') {
    return { success: false, error: 'Неизвестный статус задачи. Обновление невозможно.' }
  }

  const newStatus = task.status === 'pending' ? 'completed' : 'pending'

  // 5. Update status — guarded by id + deal_id + current status to prevent stale/race no-ops
  const { data: updated, error: updateError } = await supabase
    .from('tasks')
    .update({ status: newStatus })
    .eq('id', taskId)
    .eq('deal_id', ctx.dealId)
    .eq('status', task.status)
    .select('id')

  if (updateError) {
    console.error('toggleTaskStatusAction: DB error', updateError.message)
    return { success: false, error: 'Ошибка обновления статуса. Попробуйте снова.' }
  }

  if (!updated || updated.length === 0) {
    return { success: false, error: 'Статус задачи уже был изменён. Обновите страницу.' }
  }

  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  return { success: true }
}
