-- Migration: Stage 15A Follow-up — External Invites Management Policy Fix
-- Replaces the creator-only SELECT policy with a deal-scoped lead_advisor
-- management policy so any lead_advisor of the deal can manage external invites.
-- External users remain blocked from external_invites.

-- 1. Drop the old creator-centric policy
DROP POLICY IF EXISTS "Stage15A: external_invites SELECT for invite creators"
  ON public.external_invites;

-- 2. Add deal-scoped lead_advisor management policy
-- Only lead_advisor of the associated deal may SELECT external_invites rows.
CREATE POLICY "Stage15A: external_invites SELECT for deal lead_advisor"
  ON public.external_invites FOR SELECT
  USING (public.has_deal_role(deal_id, ARRAY['lead_advisor']));
