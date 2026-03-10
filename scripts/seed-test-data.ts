/**
 * SAFE TEST / DEMO SEED SCRIPT FOR ENTERPRISE SALE OS
 * 
 * Inserts minimal test data into the canonical Supabase project
 * using the Management API (runs SQL as postgres superuser,
 * bypassing RLS).
 * 
 * Usage:  npx tsx scripts/seed-test-data.ts
 * 
 * All seeded records are prefixed with "TEST —" or "DEMO —"
 * for easy identification and later cleanup.
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

const PROJECT_REF = 'ueiiehrwiplndeezdnba'

// Read the access token from the Supabase CLI config
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

function getAccessToken(): string {
  // 1. Environment variable (preferred for CI / scripted usage)
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    return process.env.SUPABASE_ACCESS_TOKEN
  }
  // 2. Try reading from Supabase CLI config
  const configPath = path.join(os.homedir(), 'AppData', 'Roaming', 'supabase', 'access-token')
  if (fs.existsSync(configPath)) {
    return fs.readFileSync(configPath, 'utf-8').trim()
  }
  // 3. Fallback: try settings.json
  const settingsPath = path.join(os.homedir(), 'AppData', 'Roaming', 'supabase', 'settings.json')
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    if (settings?.access_token) return settings.access_token
    if (settings?.profiles?.supabase?.access_token) return settings.profiles.supabase.access_token
  }
  throw new Error('Cannot find Supabase access token. Set SUPABASE_ACCESS_TOKEN env var or run: npx supabase login')
}

const SEED_SQL = `
DO $$
DECLARE
  v_org_id uuid := 'a0000000-0000-0000-0000-000000000001';
  v_user_id uuid := 'b0000000-0000-0000-0000-000000000001';
  v_deal_id uuid := 'c0000000-0000-0000-0000-000000000001';
  v_role_id uuid := 'd0000000-0000-0000-0000-000000000001';
  v_buyer1 uuid := 'e0000000-0000-0000-0000-000000000001';
  v_buyer2 uuid := 'e0000000-0000-0000-0000-000000000002';
  v_buyer3 uuid := 'e0000000-0000-0000-0000-000000000003';
  v_buyer4 uuid := 'e0000000-0000-0000-0000-000000000004';
  v_stage_prep uuid := 'f0000000-0000-0000-0000-000000000001';
  v_stage_teaser uuid := 'f0000000-0000-0000-0000-000000000002';
  v_stage_nda uuid := 'f0000000-0000-0000-0000-000000000003';
  v_stage_cim uuid := 'f0000000-0000-0000-0000-000000000004';
  v_stage_meetings uuid := 'f0000000-0000-0000-0000-000000000005';
  v_stage_loi uuid := 'f0000000-0000-0000-0000-000000000006';
  v_stage_dd uuid := 'f0000000-0000-0000-0000-000000000007';
  v_stage_closing uuid := 'f0000000-0000-0000-0000-000000000008';
  v_aijob1 uuid := '10000000-0000-0000-0000-000000000001';
  v_aijob2 uuid := '10000000-0000-0000-0000-000000000002';
BEGIN

  -- 1. AUTH USER
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at, confirmation_token,
    recovery_token, email_change_token_new, email_change
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'test-seller@enterprise-sale.demo',
    crypt('TestPassword123!', gen_salt('bf')),
    now(), now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    id, user_id, provider_id, provider,
    identity_data, last_sign_in_at,
    created_at, updated_at
  ) VALUES (
    v_user_id, v_user_id,
    v_user_id::text, 'email',
    jsonb_build_object('sub', v_user_id::text, 'email', 'test-seller@enterprise-sale.demo'),
    now(), now(), now()
  ) ON CONFLICT (provider_id, provider) DO NOTHING;

  -- 2. ORGANIZATION
  INSERT INTO public.organizations (id, name)
  VALUES (v_org_id, 'TEST — OOO «Альфа Капитал»')
  ON CONFLICT (id) DO NOTHING;

  -- 3. PUBLIC USER PROFILE  
  INSERT INTO public.users (id, organization_id, email, first_name, last_name)
  VALUES (v_user_id, v_org_id, 'test-seller@enterprise-sale.demo', 'Тест', 'Продавец')
  ON CONFLICT (id) DO NOTHING;

  -- 4. DEAL ROLE + DEAL
  INSERT INTO public.deal_roles (id, name, description)
  VALUES (v_role_id, 'lead_advisor', 'TEST — Ведущий консультант сделки')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.deals (id, organization_id, name, description, target_industry)
  VALUES (
    v_deal_id, v_org_id,
    'TEST — Продажа OOO «ТехноПром»',
    'DEMO — Продажа 100% доли в OOO «ТехноПром», производственная компания с EBITDA ~150 млн руб.',
    'Промышленность / Машиностроение'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.deal_members (deal_id, user_id, role_id)
  VALUES (v_deal_id, v_user_id, v_role_id)
  ON CONFLICT DO NOTHING;

  -- 5. PIPELINE STAGES
  INSERT INTO public.pipeline_stages (id, deal_id, name, sort_order) VALUES
    (v_stage_prep,     v_deal_id, 'Подготовка',          1),
    (v_stage_teaser,   v_deal_id, 'Тизер',               2),
    (v_stage_nda,      v_deal_id, 'NDA',                  3),
    (v_stage_cim,      v_deal_id, 'CIM',                  4),
    (v_stage_meetings, v_deal_id, 'Встречи',              5),
    (v_stage_loi,      v_deal_id, 'LOI/IOI',              6),
    (v_stage_dd,       v_deal_id, 'Внутренний DD',        7),
    (v_stage_closing,  v_deal_id, 'Закрытие',             8)
  ON CONFLICT (id) DO NOTHING;

  -- 6. BUYERS
  INSERT INTO public.buyers (id, deal_id, name, description, industry, website) VALUES
    (v_buyer1, v_deal_id,
     'TEST — ПАО «Северсталь Инвест»',
     'DEMO — Стратегический покупатель, заинтересован в вертикальной интеграции',
     'Металлургия', 'https://example.com/severstal'),
    (v_buyer2, v_deal_id,
     'TEST — Baring Vostok Capital Partners',
     'DEMO — Финансовый инвестор (PE), фонд среднего рынка',
     'Private Equity', 'https://example.com/baring'),
    (v_buyer3, v_deal_id,
     'TEST — ГК «Ростех»',
     'DEMO — Государственная корпорация, интерес к маш.строительным активам',
     'Госсектор / Оборона', 'https://example.com/rostec'),
    (v_buyer4, v_deal_id,
     'TEST — АФК «Система»',
     'DEMO — Диверсифицированный холдинг, рассматривают новые промышленные активы',
     'Конгломерат', 'https://example.com/sistema')
  ON CONFLICT (id) DO NOTHING;

  -- 7. BUYER PIPELINE STATES
  INSERT INTO public.buyer_pipeline_states (buyer_id, stage_id) VALUES
    (v_buyer1, v_stage_cim),
    (v_buyer2, v_stage_meetings),
    (v_buyer3, v_stage_nda),
    (v_buyer4, v_stage_teaser)
  ON CONFLICT (buyer_id) DO NOTHING;

  -- 8. TASKS
  INSERT INTO public.tasks (deal_id, created_by, title, description, status) VALUES
    (v_deal_id, v_user_id,
     'TEST — Подготовить CIM для Baring Vostok',
     'DEMO — Финализировать Confidential Information Memorandum для отправки финансовому инвестору',
     'pending'),
    (v_deal_id, v_user_id,
     'TEST — Согласовать NDA с ГК Ростех',
     'DEMO — Направить юристам актуальную версию NDA для подписания',
     'pending'),
    (v_deal_id, v_user_id,
     'TEST — Запросить аудированную отчётность за 2025',
     'DEMO — Получить от бухгалтерии финальную версию отчётности',
     'pending'),
    (v_deal_id, v_user_id,
     'TEST — Обновить тизер для АФК Система',
     'DEMO — Актуализировать данные в тизере с учётом последних показателей',
     'pending'),
    (v_deal_id, v_user_id,
     'TEST — Провести management-презентацию для Северсталь',
     'DEMO — Организовать встречу менеджмента с командой покупателя',
     'completed');

  -- 9. COMMUNICATIONS
  INSERT INTO public.communications (buyer_id, logged_by, type, content, date) VALUES
    (v_buyer1, v_user_id, 'Email',
     'TEST — Направлен запрос дополнительной информации по производственным мощностям.',
     now() - interval '2 days'),
    (v_buyer2, v_user_id, 'Call',
     'TEST — Звонок с партнёром Baring Vostok. Обсуждали структуру сделки.',
     now() - interval '1 day'),
    (v_buyer3, v_user_id, 'Meeting',
     'TEST — Вводная встреча с представителем ГК Ростех. Представлен обзор актива.',
     now() - interval '3 days'),
    (v_buyer4, v_user_id, 'Note',
     'TEST — Внутренняя заметка: АФК Система пока на стадии тизера.',
     now() - interval '5 hours');

  -- 10. AI JOBS + AI OUTPUTS
  INSERT INTO public.ai_jobs (id, deal_id, created_by, action_type, status, context) VALUES
    (v_aijob1, v_deal_id, v_user_id,
     'document_summarization', 'completed',
     '{"document_name": "TEST — CIM_TechnoProm_2025.pdf"}'::jsonb),
    (v_aijob2, v_deal_id, v_user_id,
     'email_drafting', 'completed',
     '{"buyer_name": "TEST — ПАО Северсталь Инвест", "purpose": "status_update"}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ai_outputs (job_id, deal_id, generated_text, status) VALUES
    (v_aijob1, v_deal_id,
     'TEST — Краткое содержание CIM: OOO «ТехноПром» — производственная компания, основанная в 2008 году. EBITDA: ~150 млн руб.',
     'pending_review'),
    (v_aijob2, v_deal_id,
     'TEST — Уважаемые коллеги из ПАО «Северсталь Инвест», направляем актуальную информацию по статусу сделки.',
     'pending_review');

  RAISE NOTICE 'Seed data inserted successfully.';
END $$;
`

async function executeSql(sql: string): Promise<void> {
  const token = getAccessToken()
  
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`SQL execution failed (${response.status}): ${body}`)
  }

  const result = await response.json()
  console.log('SQL execution result:', JSON.stringify(result, null, 2))
}

async function verifySeed(): Promise<void> {
  const token = getAccessToken()
  
  const tables = [
    'organizations', 'users', 'deals', 'buyers',
    'pipeline_stages', 'buyer_pipeline_states',
    'tasks', 'communications', 'ai_jobs', 'ai_outputs'
  ]
  
  console.log('\n=== POST-SEED VERIFICATION ===')
  for (const table of tables) {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: `SELECT count(*) as cnt FROM public.${table}` }),
      }
    )
    
    if (response.ok) {
      const result = await response.json()
      const count = result?.[0]?.cnt ?? result?.[0]?.count ?? '??'
      console.log(`  ${table}: ${count} rows`)
    } else {
      console.log(`  ${table}: ERROR (${response.status})`)
    }
  }
}

async function main() {
  console.log('Executing seed SQL against project:', PROJECT_REF)
  console.log('---')
  
  try {
    await executeSql(SEED_SQL)
    console.log('\n✓ Seed SQL executed successfully')
  } catch (err: any) {
    console.error('\n✗ Seed execution failed:', err.message)
    process.exit(1)
  }
  
  try {
    await verifySeed()
    console.log('\n✓ Verification complete')
  } catch (err: any) {
    console.error('\n✗ Verification failed:', err.message)
  }
}

main()
