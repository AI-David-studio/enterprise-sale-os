'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { VertexAI } from '@google-cloud/vertexai'

const getVertexAI = () => {
  const project = process.env.GOOGLE_CLOUD_PROJECT_ID
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'europe-west4'
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON

  if (!project || !credentialsJson) {
    throw new Error('Vertex AI configuration is missing in environment variables.')
  }

  const credentials = JSON.parse(credentialsJson)

  return new VertexAI({
    project,
    location,
    googleAuthOptions: {
      credentials,
    },
  })
}

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

  // 2. Advance the status to 'processing'
  await supabase.from('ai_jobs').update({ status: 'processing' }).eq('id', job.id)

  try {
    // 3. Generative execution using @google-cloud/vertexai
    const { data: doc } = await supabase.from('documents').select('name, category').eq('id', documentId).single()
    const docContext = doc ? `Название документа: ${doc.name}\nКатегория: ${doc.category || 'Без категории'}` : `ID документа: ${documentId}`

    const vertexAI = getVertexAI()
    const model = process.env.VERTEX_MODEL_NAME || 'gemini-1.5-flash'
    const generativeModel = vertexAI.getGenerativeModel({ model })

    const prompt = `Ты — AI-ассистент (Copilot) для продавца в B2B-системе. 
Твоя задача — составить краткое профессиональное резюме документа на основе его метаданных (мы не передаем тебе полный текст файла). 
Текст резюме должен быть строго на русском языке.
Не придумывай лишних фактов, просто укажи, основываясь на названии и категории, о чем обычно такие документы и какова их роль в корпоративной сделке. Уложись в 2-3 предложения.

Инфо о документе:
${docContext}

Выведи только текст резюме.`

    const resp = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
    
    const generatedText = resp.response.candidates?.[0]?.content?.parts?.[0]?.text || 'Ошибка: Пустой ответ от Vertex AI.'
    
    // 4. Staging the AI response
    await supabase.from('ai_outputs').insert({
      job_id: job.id,
      deal_id: dealId,
      generated_text: generatedText,
      status: 'pending_review'
    })

    // 5. Close the job
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

  // 2. Advance the status to 'processing'
  await supabase.from('ai_jobs').update({ status: 'processing' }).eq('id', job.id)

  try {
    // 3. Generative execution using @google-cloud/vertexai
    const { data: buyer } = await supabase
      .from('buyers')
      .select('name, industry, description, buyer_pipeline_states(pipeline_stages(name))')
      .eq('id', buyerId)
      .single()
      
    const pipelineStage = (buyer?.buyer_pipeline_states?.[0]?.pipeline_stages as any)?.name || 'Неизвестный этап'
    
    const { data: comms } = await supabase
      .from('communications')
      .select('type, content, date')
      .eq('buyer_id', buyerId)
      .order('date', { ascending: false })
      .limit(3)
      
    const commsText = comms && comms.length > 0 
      ? comms.map((c: any) => `[${new Date(c.date).toLocaleDateString('ru-RU')}] ${c.type}: ${c.content}`).join('\n')
      : 'Нет предыдущей истории коммуникаций.'

    const buyerContext = `Покупатель: ${buyer?.name || 'Неизвестно'}\nОтрасль: ${buyer?.industry || 'Неизвестно'}\nТекущий этап воронки: ${pipelineStage}\nОписание: ${buyer?.description || 'Нет'}`

    const vertexAI = getVertexAI()
    const model = process.env.VERTEX_MODEL_NAME || 'gemini-1.5-flash'
    const generativeModel = vertexAI.getGenerativeModel({ model })

    const prompt = `Ты — AI-ассистент (Copilot) для продавца в B2B-системе. 
Подготовь профессиональный черновик нового письма (email) для покупателя, чтобы продвинуть сделку вперед.
Текст письма должен быть строго на русском языке. Учти текущий этап воронки продаж и историю общения.

Контекст покупателя:
${buyerContext}

Последние коммуникации:
${commsText}

Выведи только текст черновика письма, без лишних вступлений.`

    const resp = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
    
    const generatedText = resp.response.candidates?.[0]?.content?.parts?.[0]?.text || 'Ошибка: Пустой ответ от Vertex AI.'
    
    // 4. Staging the AI response
    await supabase.from('ai_outputs').insert({
      job_id: job.id,
      deal_id: dealId,
      generated_text: generatedText,
      status: 'pending_review'
    })

    // 5. Close the job
    await supabase.from('ai_jobs').update({ status: 'completed' }).eq('id', job.id)

    revalidatePath('/ai-review')
    return { success: true }
  } catch (err: any) {
    await supabase.from('ai_jobs').update({ status: 'failed', error_message: err.message }).eq('id', job.id)
    return { success: false, error: err.message }
  }
}
