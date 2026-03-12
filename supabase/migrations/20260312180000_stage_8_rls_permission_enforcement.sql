-- Migration: Stage 8 — RLS Permission Enforcement
-- Replaces organization-scoped deal-entity RLS with deal-membership-scoped RLS.
-- Preserves users / organizations / deal_invites / deal_roles policies unchanged.
-- deal_members remains SELECT-only under public RLS (writes via adminClient only).

-- ============================================================================
-- 1. HELPER FUNCTION: has_deal_role
-- ============================================================================
-- SECURITY DEFINER bypasses RLS within the function body, preventing
-- recursive evaluation when this function is called from deal_members' own
-- SELECT policy. SET search_path = public prevents search_path injection.
--
-- Contract:
--   has_deal_role(p_deal_id UUID, p_roles TEXT[] DEFAULT NULL)
--   Returns TRUE if auth.uid() is a member of p_deal_id with a role whose
--   name is in p_roles. If p_roles is NULL, returns TRUE for any membership.

CREATE OR REPLACE FUNCTION public.has_deal_role(
  p_deal_id UUID,
  p_roles TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM deal_members dm
    JOIN deal_roles dr ON dm.role_id = dr.id
    WHERE dm.deal_id = p_deal_id
      AND dm.user_id = auth.uid()
      AND (p_roles IS NULL OR dr.name = ANY(p_roles))
  );
$$;

-- ============================================================================
-- 2. DROP OLD ORG-SCOPED POLICIES (deal business entities only)
-- ============================================================================

-- deals (Stage 2: FOR ALL)
DROP POLICY IF EXISTS "Deals are viewable by assigned organization users" ON public.deals;

-- buyers (Stage 2: FOR ALL)
DROP POLICY IF EXISTS "Buyers are viewable by assigned deal users" ON public.buyers;

-- pipeline_stages (Stage 2: FOR ALL)
DROP POLICY IF EXISTS "Pipeline stages are viewable by assigned deal users" ON public.pipeline_stages;

-- buyer_pipeline_states (Stage 2: FOR ALL)
DROP POLICY IF EXISTS "Buyer pipeline states are viewable by assigned deal users" ON public.buyer_pipeline_states;

-- documents (Stage 3: separate SELECT + INSERT)
DROP POLICY IF EXISTS "Documents are viewable by assigned deal users" ON public.documents;
DROP POLICY IF EXISTS "Documents are insertable by assigned deal users" ON public.documents;

-- communications (Stage 3: separate SELECT + INSERT)
DROP POLICY IF EXISTS "Communications are viewable by assigned deal users" ON public.communications;
DROP POLICY IF EXISTS "Communications are insertable by assigned deal users" ON public.communications;

-- tasks (Stage 3: separate SELECT + INSERT + UPDATE + DELETE)
DROP POLICY IF EXISTS "Tasks are viewable by assigned deal users" ON public.tasks;
DROP POLICY IF EXISTS "Tasks are insertable by assigned deal users" ON public.tasks;
DROP POLICY IF EXISTS "Tasks are updatable by assigned deal users" ON public.tasks;
DROP POLICY IF EXISTS "Tasks are deletable by assigned deal users" ON public.tasks;

-- ai_jobs (Stage 4: separate SELECT + INSERT + UPDATE)
DROP POLICY IF EXISTS "AI Jobs are viewable by assigned deal users" ON public.ai_jobs;
DROP POLICY IF EXISTS "AI Jobs are insertable by assigned deal users" ON public.ai_jobs;
DROP POLICY IF EXISTS "AI Jobs are updatable by assigned deal users" ON public.ai_jobs;

-- ai_outputs (Stage 4: separate SELECT + UPDATE)
DROP POLICY IF EXISTS "AI Outputs are viewable by assigned deal users" ON public.ai_outputs;
DROP POLICY IF EXISTS "AI Outputs are updatable by assigned deal users" ON public.ai_outputs;

-- deal_members (Stage 1: self-referencing SELECT — replace with helper-based)
DROP POLICY IF EXISTS "Users can view members of their own deals" ON public.deal_members;

-- ============================================================================
-- 3. NEW DEAL-MEMBERSHIP-SCOPED POLICIES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 3.1 deals (anchor: deals.id)
-- ---------------------------------------------------------------------------
-- SELECT: any deal member
CREATE POLICY "Stage8: deals SELECT for deal members"
  ON public.deals FOR SELECT
  USING (public.has_deal_role(id, NULL::TEXT[]));

-- INSERT: lead_advisor only
-- NOTE: This policy is intentionally conservative. Normal deal creation
-- remains in trusted server-side provisioning (register action). This
-- policy exists to prevent unauthorized client-side deal creation.
CREATE POLICY "Stage8: deals INSERT for lead_advisor"
  ON public.deals FOR INSERT
  WITH CHECK (public.has_deal_role(id, ARRAY['lead_advisor']));

-- UPDATE: lead_advisor only
CREATE POLICY "Stage8: deals UPDATE for lead_advisor"
  ON public.deals FOR UPDATE
  USING (public.has_deal_role(id, ARRAY['lead_advisor']))
  WITH CHECK (public.has_deal_role(id, ARRAY['lead_advisor']));

-- DELETE: lead_advisor only
CREATE POLICY "Stage8: deals DELETE for lead_advisor"
  ON public.deals FOR DELETE
  USING (public.has_deal_role(id, ARRAY['lead_advisor']));

-- ---------------------------------------------------------------------------
-- 3.2 buyers (anchor: buyers.deal_id)
-- ---------------------------------------------------------------------------
-- SELECT: any deal member
CREATE POLICY "Stage8: buyers SELECT for deal members"
  ON public.buyers FOR SELECT
  USING (public.has_deal_role(deal_id, NULL::TEXT[]));

-- INSERT: lead_advisor only
CREATE POLICY "Stage8: buyers INSERT for lead_advisor"
  ON public.buyers FOR INSERT
  WITH CHECK (public.has_deal_role(deal_id, ARRAY['lead_advisor']));

-- UPDATE: lead_advisor only
CREATE POLICY "Stage8: buyers UPDATE for lead_advisor"
  ON public.buyers FOR UPDATE
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor']))
  WITH CHECK (public.has_deal_role(deal_id, ARRAY['lead_advisor']));

-- DELETE: lead_advisor only
CREATE POLICY "Stage8: buyers DELETE for lead_advisor"
  ON public.buyers FOR DELETE
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor']));

-- ---------------------------------------------------------------------------
-- 3.3 pipeline_stages (anchor: pipeline_stages.deal_id)
-- ---------------------------------------------------------------------------
-- SELECT: any deal member
CREATE POLICY "Stage8: pipeline_stages SELECT for deal members"
  ON public.pipeline_stages FOR SELECT
  USING (public.has_deal_role(deal_id, NULL::TEXT[]));

-- INSERT: lead_advisor only
CREATE POLICY "Stage8: pipeline_stages INSERT for lead_advisor"
  ON public.pipeline_stages FOR INSERT
  WITH CHECK (public.has_deal_role(deal_id, ARRAY['lead_advisor']));

-- UPDATE: lead_advisor only
CREATE POLICY "Stage8: pipeline_stages UPDATE for lead_advisor"
  ON public.pipeline_stages FOR UPDATE
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor']))
  WITH CHECK (public.has_deal_role(deal_id, ARRAY['lead_advisor']));

-- DELETE: lead_advisor only
CREATE POLICY "Stage8: pipeline_stages DELETE for lead_advisor"
  ON public.pipeline_stages FOR DELETE
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor']));

-- ---------------------------------------------------------------------------
-- 3.4 documents (anchor: documents.deal_id)
-- ---------------------------------------------------------------------------
-- SELECT: any deal member (including viewer)
CREATE POLICY "Stage8: documents SELECT for deal members"
  ON public.documents FOR SELECT
  USING (public.has_deal_role(deal_id, NULL::TEXT[]));

-- INSERT: lead_advisor or advisor
CREATE POLICY "Stage8: documents INSERT for lead_advisor or advisor"
  ON public.documents FOR INSERT
  WITH CHECK (public.has_deal_role(deal_id, ARRAY['lead_advisor', 'advisor']));

-- UPDATE: lead_advisor or advisor
CREATE POLICY "Stage8: documents UPDATE for lead_advisor or advisor"
  ON public.documents FOR UPDATE
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor', 'advisor']))
  WITH CHECK (public.has_deal_role(deal_id, ARRAY['lead_advisor', 'advisor']));

-- DELETE: lead_advisor or advisor
CREATE POLICY "Stage8: documents DELETE for lead_advisor or advisor"
  ON public.documents FOR DELETE
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor', 'advisor']));

-- ---------------------------------------------------------------------------
-- 3.5 buyer_pipeline_states (anchor: buyer_id -> buyers.deal_id)
-- ---------------------------------------------------------------------------
-- SELECT: any deal member
CREATE POLICY "Stage8: buyer_pipeline_states SELECT for deal members"
  ON public.buyer_pipeline_states FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.buyers b
      WHERE b.id = buyer_pipeline_states.buyer_id
        AND public.has_deal_role(b.deal_id, NULL::TEXT[])
    )
  );

-- INSERT: lead_advisor only
CREATE POLICY "Stage8: buyer_pipeline_states INSERT for lead_advisor"
  ON public.buyer_pipeline_states FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.buyers b
      WHERE b.id = buyer_pipeline_states.buyer_id
        AND public.has_deal_role(b.deal_id, ARRAY['lead_advisor'])
    )
  );

-- UPDATE: lead_advisor only
CREATE POLICY "Stage8: buyer_pipeline_states UPDATE for lead_advisor"
  ON public.buyer_pipeline_states FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.buyers b
      WHERE b.id = buyer_pipeline_states.buyer_id
        AND public.has_deal_role(b.deal_id, ARRAY['lead_advisor'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.buyers b
      WHERE b.id = buyer_pipeline_states.buyer_id
        AND public.has_deal_role(b.deal_id, ARRAY['lead_advisor'])
    )
  );

-- DELETE: lead_advisor only
CREATE POLICY "Stage8: buyer_pipeline_states DELETE for lead_advisor"
  ON public.buyer_pipeline_states FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.buyers b
      WHERE b.id = buyer_pipeline_states.buyer_id
        AND public.has_deal_role(b.deal_id, ARRAY['lead_advisor'])
    )
  );

-- ---------------------------------------------------------------------------
-- 3.6 communications (anchor: buyer_id -> buyers.deal_id)
-- viewer is fully blocked by DB-level RLS (not just UI hiding)
-- ---------------------------------------------------------------------------
-- SELECT: lead_advisor or advisor only
CREATE POLICY "Stage8: communications SELECT for lead_advisor or advisor"
  ON public.communications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.buyers b
      WHERE b.id = communications.buyer_id
        AND public.has_deal_role(b.deal_id, ARRAY['lead_advisor', 'advisor'])
    )
  );

-- INSERT: lead_advisor or advisor only
CREATE POLICY "Stage8: communications INSERT for lead_advisor or advisor"
  ON public.communications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.buyers b
      WHERE b.id = communications.buyer_id
        AND public.has_deal_role(b.deal_id, ARRAY['lead_advisor', 'advisor'])
    )
  );

-- UPDATE: lead_advisor or advisor only
CREATE POLICY "Stage8: communications UPDATE for lead_advisor or advisor"
  ON public.communications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.buyers b
      WHERE b.id = communications.buyer_id
        AND public.has_deal_role(b.deal_id, ARRAY['lead_advisor', 'advisor'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.buyers b
      WHERE b.id = communications.buyer_id
        AND public.has_deal_role(b.deal_id, ARRAY['lead_advisor', 'advisor'])
    )
  );

-- DELETE: lead_advisor or advisor only
CREATE POLICY "Stage8: communications DELETE for lead_advisor or advisor"
  ON public.communications FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.buyers b
      WHERE b.id = communications.buyer_id
        AND public.has_deal_role(b.deal_id, ARRAY['lead_advisor', 'advisor'])
    )
  );

-- ---------------------------------------------------------------------------
-- 3.7 tasks (anchor: tasks.deal_id)
-- viewer is fully blocked by DB-level RLS
-- ---------------------------------------------------------------------------
-- SELECT: lead_advisor or advisor only
CREATE POLICY "Stage8: tasks SELECT for lead_advisor or advisor"
  ON public.tasks FOR SELECT
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor', 'advisor']));

-- INSERT: lead_advisor or advisor only
CREATE POLICY "Stage8: tasks INSERT for lead_advisor or advisor"
  ON public.tasks FOR INSERT
  WITH CHECK (public.has_deal_role(deal_id, ARRAY['lead_advisor', 'advisor']));

-- UPDATE: lead_advisor or advisor only
CREATE POLICY "Stage8: tasks UPDATE for lead_advisor or advisor"
  ON public.tasks FOR UPDATE
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor', 'advisor']))
  WITH CHECK (public.has_deal_role(deal_id, ARRAY['lead_advisor', 'advisor']));

-- DELETE: lead_advisor or advisor only
CREATE POLICY "Stage8: tasks DELETE for lead_advisor or advisor"
  ON public.tasks FOR DELETE
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor', 'advisor']));

-- ---------------------------------------------------------------------------
-- 3.8 ai_jobs (anchor: ai_jobs.deal_id)
-- lead_advisor only for ALL operations
-- ---------------------------------------------------------------------------
CREATE POLICY "Stage8: ai_jobs SELECT for lead_advisor"
  ON public.ai_jobs FOR SELECT
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor']));

CREATE POLICY "Stage8: ai_jobs INSERT for lead_advisor"
  ON public.ai_jobs FOR INSERT
  WITH CHECK (public.has_deal_role(deal_id, ARRAY['lead_advisor']));

CREATE POLICY "Stage8: ai_jobs UPDATE for lead_advisor"
  ON public.ai_jobs FOR UPDATE
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor']))
  WITH CHECK (public.has_deal_role(deal_id, ARRAY['lead_advisor']));

CREATE POLICY "Stage8: ai_jobs DELETE for lead_advisor"
  ON public.ai_jobs FOR DELETE
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor']));

-- ---------------------------------------------------------------------------
-- 3.9 ai_outputs (anchor: ai_outputs.deal_id)
-- lead_advisor only for ALL operations
-- ---------------------------------------------------------------------------
CREATE POLICY "Stage8: ai_outputs SELECT for lead_advisor"
  ON public.ai_outputs FOR SELECT
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor']));

CREATE POLICY "Stage8: ai_outputs INSERT for lead_advisor"
  ON public.ai_outputs FOR INSERT
  WITH CHECK (public.has_deal_role(deal_id, ARRAY['lead_advisor']));

CREATE POLICY "Stage8: ai_outputs UPDATE for lead_advisor"
  ON public.ai_outputs FOR UPDATE
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor']))
  WITH CHECK (public.has_deal_role(deal_id, ARRAY['lead_advisor']));

CREATE POLICY "Stage8: ai_outputs DELETE for lead_advisor"
  ON public.ai_outputs FOR DELETE
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor']));

-- ---------------------------------------------------------------------------
-- 3.10 deal_members (anchor: deal_members.deal_id)
-- SELECT only — no public INSERT/UPDATE/DELETE policies
-- Membership mutations happen exclusively via trusted server adminClient.
-- Uses the SECURITY DEFINER helper which bypasses RLS on deal_members itself,
-- preventing the recursive self-referencing loop.
-- ---------------------------------------------------------------------------
CREATE POLICY "Stage8: deal_members SELECT for deal members"
  ON public.deal_members FOR SELECT
  USING (public.has_deal_role(deal_id, NULL::TEXT[]));

-- ============================================================================
-- 4. TABLES INTENTIONALLY UNCHANGED BY THIS MIGRATION
-- ============================================================================
-- users:         Policies unchanged (self-profile + org visibility residual risk)
-- organizations: Policies unchanged (org-member visibility residual risk)
-- deal_roles:    Policies unchanged (globally viewable to authenticated)
-- deal_invites:  Policies unchanged (inviter-only SELECT; acceptance via adminClient)
