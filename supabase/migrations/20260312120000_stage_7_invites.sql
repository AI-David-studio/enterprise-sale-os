-- Migration: Stage 7A — Invite Flow Schema
-- Creates deal_invites table, seeds advisor/viewer roles
-- Safe to re-run: uses IF NOT EXISTS / DO $$ guards throughout

-- 1. Create deal_invites table (guarded)
CREATE TABLE IF NOT EXISTS public.deal_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.deal_roles(id) ON DELETE RESTRICT,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  accepted_by uuid REFERENCES public.users(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- 1b. Guarded status CHECK constraint (applies even if table pre-existed without it)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deal_invites_status_check'
  ) THEN
    ALTER TABLE public.deal_invites
      ADD CONSTRAINT deal_invites_status_check
      CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'));
  END IF;
END $$;

-- 2. Enable RLS (idempotent)
ALTER TABLE public.deal_invites ENABLE ROW LEVEL SECURITY;

-- 3. RLS policy: only the invite creator can read their own invites (guarded)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'deal_invites'
      AND policyname = 'Invite creators can view their own invites'
  ) THEN
    CREATE POLICY "Invite creators can view their own invites" ON public.deal_invites
      FOR SELECT USING (invited_by = auth.uid());
  END IF;
END $$;

-- 4a. Duplicate precheck: fail clearly if duplicates already exist in deal_members
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.deal_members
    GROUP BY deal_id, user_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add deal_members_deal_user_unique: duplicate (deal_id, user_id) rows already exist in public.deal_members.';
  END IF;
END $$;

-- 4b. Prevent duplicate deal_members for the same (deal_id, user_id) at DB level (guarded)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deal_members_deal_user_unique'
  ) THEN
    ALTER TABLE public.deal_members
      ADD CONSTRAINT deal_members_deal_user_unique UNIQUE (deal_id, user_id);
  END IF;
END $$;

-- 4c. DB-level concurrency guard: only one pending invite per deal+email
CREATE UNIQUE INDEX IF NOT EXISTS deal_invites_pending_deal_email_unique
  ON public.deal_invites (deal_id, lower(email))
  WHERE status = 'pending';

-- 5. Seed advisor and viewer roles idempotently
INSERT INTO public.deal_roles (name, description)
SELECT 'advisor', 'Консультант сделки (чтение + документы)'
WHERE NOT EXISTS (SELECT 1 FROM public.deal_roles WHERE name = 'advisor');

INSERT INTO public.deal_roles (name, description)
SELECT 'viewer', 'Наблюдатель (только чтение)'
WHERE NOT EXISTS (SELECT 1 FROM public.deal_roles WHERE name = 'viewer');
