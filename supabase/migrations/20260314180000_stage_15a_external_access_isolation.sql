-- Migration: Stage 15A — External Access Security Isolation
-- Creates a separate external-access model that isolates external principals
-- from internal seller-side deal_members semantics.
-- Internal Stage 8 RLS remains completely untouched.

-- ============================================================================
-- 1. ADD EXTERNAL DOCUMENT ALLOWLISTING FLAG
-- ============================================================================
-- Default FALSE = all existing documents remain internal-only.
-- Only documents explicitly marked is_external=TRUE will be visible to
-- external principals via the new external RLS policies.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS is_external BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- 2. CREATE EXTERNAL ACCESS TABLE
-- ============================================================================
-- External principals are NEVER added to deal_members.
-- This table is the sole source of truth for external access grants.
-- Revoked rows (revoked_at IS NOT NULL) remain for audit purposes.

CREATE TABLE IF NOT EXISTS public.external_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  granted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  revoked_at TIMESTAMPTZ NULL,
  revoked_by UUID NULL REFERENCES public.users(id) ON DELETE RESTRICT
);

-- One active (non-revoked) access row per (deal_id, user_id)
CREATE UNIQUE INDEX IF NOT EXISTS external_access_active_deal_user_unique
  ON public.external_access (deal_id, user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.external_access ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. HELPER FUNCTION: has_external_access
-- ============================================================================
-- SECURITY DEFINER bypasses RLS within the function body.
-- Returns TRUE only if auth.uid() has an active, non-revoked row
-- in external_access for the specified deal.

CREATE OR REPLACE FUNCTION public.has_external_access(p_deal_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM external_access ea
    WHERE ea.deal_id = p_deal_id
      AND ea.user_id = auth.uid()
      AND ea.revoked_at IS NULL
  );
$$;

-- ============================================================================
-- 4. RLS POLICIES FOR EXTERNAL ACCESS TABLE
-- ============================================================================
-- External users can only read their own active access row(s).
-- No INSERT/UPDATE/DELETE for external users — managed via admin server actions.

CREATE POLICY "Stage15A: external_access SELECT own rows"
  ON public.external_access FOR SELECT
  USING (user_id = auth.uid());

-- Internal deal members (lead_advisor) can also read external_access
-- to manage/view external grants for their deal.
CREATE POLICY "Stage15A: external_access SELECT for lead_advisor"
  ON public.external_access FOR SELECT
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor']));

-- ============================================================================
-- 5. EXTERNAL DOCUMENT VISIBILITY POLICY
-- ============================================================================
-- External principals can SELECT only documents that are:
--   (a) in a deal they have active external access to, AND
--   (b) explicitly marked as is_external = TRUE.
-- This is a NEW additive policy. Existing internal policies are untouched.
-- Supabase RLS uses OR semantics across multiple SELECT policies,
-- so this policy grants access alongside (not replacing) existing internal policies.

CREATE POLICY "Stage15A: documents SELECT for external access (allowlisted only)"
  ON public.documents FOR SELECT
  USING (
    is_external = TRUE
    AND public.has_external_access(deal_id)
  );

-- ============================================================================
-- 6. EXTERNAL INVITES TABLE (separate from internal deal_invites)
-- ============================================================================
-- External invitations use their own table to prevent contamination of
-- the internal invite flow. Acceptance creates external_access rows,
-- NOT deal_members rows.

CREATE TABLE IF NOT EXISTS public.external_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  accepted_by UUID REFERENCES public.users(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT external_invites_status_check CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

-- One pending external invite per (deal_id, email)
CREATE UNIQUE INDEX IF NOT EXISTS external_invites_pending_deal_email_unique
  ON public.external_invites (deal_id, lower(email))
  WHERE status = 'pending';

ALTER TABLE public.external_invites ENABLE ROW LEVEL SECURITY;

-- Only the invite creator (lead_advisor) can view their own external invites
CREATE POLICY "Stage15A: external_invites SELECT for invite creators"
  ON public.external_invites FOR SELECT
  USING (invited_by = auth.uid());

-- ============================================================================
-- 7. STORAGE HARDENING
-- ============================================================================
-- Current broad policies allow any authenticated user to read/insert vault objects.
-- Since ALL storage access in the application is server-mediated
-- (adminClient with service role key), these broad policies are unused
-- but create a theoretical direct-API leak vector for external users.
--
-- Strategy:
--   Drop the broad authenticated SELECT and INSERT policies.
--   All storage I/O continues through admin/service-role which bypasses
--   storage RLS entirely, so internal document flows remain fully functional.
--   External users can no longer access vault objects via direct Supabase API.

DROP POLICY IF EXISTS "Vault files are viewable by authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Vault files are insertable by authenticated users" ON storage.objects;

-- ============================================================================
-- 8. TABLES INTENTIONALLY UNCHANGED BY THIS MIGRATION
-- ============================================================================
-- deals:                  No external SELECT policy added (per Stage 15A scope).
-- buyers:                 No external policy. Zero rows for external users.
-- pipeline_stages:        No external policy. Zero rows for external users.
-- buyer_pipeline_states:  No external policy. Zero rows for external users.
-- communications:         No external policy. Zero rows for external users.
-- tasks:                  No external policy. Zero rows for external users.
-- ai_jobs:                No external policy. Zero rows for external users.
-- ai_outputs:             No external policy. Zero rows for external users.
-- deal_members:           No external policy. Zero rows for external users.
-- deal_invites:           No external policy. Zero rows for external users.
-- users:                  Unchanged (residual risk accepted per Stage 8).
-- organizations:          Unchanged (residual risk accepted per Stage 8).
