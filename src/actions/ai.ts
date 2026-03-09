'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// Hardcoded Vertex AI endpoint & fetch for MVP context
// In a real application, the Google Auth Library would be used.
// For the sake of this prompt, we simulate the fetch response structure to fulfill the job orchestration loop.

export async function requestAISummarization(dealId: string, documentId: string) {
  const supabase = await createClient()

  // 1. Create the AI Job
  const { data: job, error: jobError } = await supabase
    .from('ai_jobs')
    .insert({
      deal_id: dealId,
      created_by: (await supabase.auth.getUser()).data.user?.id,
      action_type: 'document_summarization',
      status: 'pending',
      context: { document_id: documentId }
    })
    .select()
    .single()

  if (jobError || !job) {
    console.error('Failed to create AI job', jobError)
    throw new Error('Failed to create AI job')
  }

  // 2. Mock Edge Function / Vertex AI Execution path 
  // We advance the status to 'processing'
  await supabase.from('ai_jobs').update({ status: 'processing' }).eq('id', job.id)

  try {
    // In actual MVP, Vertex AI fetch would live here:
    // const response = await fetch(`https://${location}-aiplatform.googleapis.com/...:generateContent`, { ... })
    
    // 3. Staging simulated AI response logic
    const mockGeneratedText = `[Симуляция Vertex AI]: Это краткое резюме документа ID ${documentId}. Документ содержит ключевые финансовые показатели и соглашения о неразглашении. Требуется дальнейшее изучение раздела 4.`
    
    await supabase.from('ai_outputs').insert({
      job_id: job.id,
      deal_id: dealId,
      generated_text: mockGeneratedText,
      status: 'pending_review'
    })

    // 4. Close the job
    await supabase.from('ai_jobs').update({ status: 'completed' }).eq('id', job.id)

    revalidatePath('/ai-review')
    return { success: true }

  } catch (err: any) {
    await supabase.from('ai_jobs').update({ status: 'failed', error_message: err.message }).eq('id', job.id)
    return { success: false, error: err.message }
  }
}

export async function requestAIEmailDraft(dealId: string, buyerId: string) {
  const supabase = await createClient()

  // 1. Create the AI Job
  const { data: job, error: jobError } = await supabase
    .from('ai_jobs')
    .insert({
      deal_id: dealId,
      created_by: (await supabase.auth.getUser()).data.user?.id,
      action_type: 'email_drafting',
      status: 'pending',
      context: { buyer_id: buyerId }
    })
    .select()
    .single()

  if (jobError || !job) {
    console.error('Failed to create AI job', jobError)
    throw new Error('Failed to create AI job')
  }

  // 2. Mock Edge Function / Vertex AI request path
  await supabase.from('ai_jobs').update({ status: 'processing' }).eq('id', job.id)

  try {
    // 3. Staging simulated AI response
    const mockGeneratedText = `Уважаемые партнеры,\n\nМы готовы перейти к следующему этапу обсуждения сделки. Пожалуйста, предоставьте необходимые документы (NDA подписан).\n\nЖду вашего ответа.\nС уважением,\nПродавец`
    
    await supabase.from('ai_outputs').insert({
      job_id: job.id,
      deal_id: dealId,
      generated_text: mockGeneratedText,
      status: 'pending_review'
    })

    // 4. Close the job
    await supabase.from('ai_jobs').update({ status: 'completed' }).eq('id', job.id)

    revalidatePath('/ai-review')
    return { success: true }
  } catch (err: any) {
    await supabase.from('ai_jobs').update({ status: 'failed', error_message: err.message }).eq('id', job.id)
    return { success: false, error: err.message }
  }
}
