# STAGE 15 PRECONDITION: EXTERNAL SECURITY ISOLATION PLANNING

## 1. Stage Name
Stage 15 Precondition: External Security Isolation Planning

## 2. Purpose
Define the external-access isolation model required before any buyer/investor portal UI can be built. This document is PLANNING ONLY — no code, schema, SQL, or UI implementation is permitted during this stage.

## 3. Why This Stage Must Exist Before Any Portal UI
The current security model (Stage 8 RLS) was designed exclusively for internal seller-side collaboration. Every authenticated user who is a `deal_member` — regardless of role — can read core CRM entities (buyers, pipeline stages, documents) through direct Supabase API queries. If an external buyer-side evaluator were added as a `deal_member` with any existing role, they would gain lateral visibility into competing buyers, internal working documents, and pipeline progression data. This is a fundamental M&A confidentiality violation that cannot be mitigated at the UI layer alone; it must be solved at the data layer before any external-facing surface is built.

## 4. External Persona Definition
- **Identity**: External buyer-side evaluator or investor representative.
- **Scope**: Invited to review exactly one deal. No multi-deal visibility.
- **Access level**: Strictly read-only. No mutations of any kind.
- **Forbidden capabilities**: Workflow progression, NDA execution, offer handling, messaging, pipeline stage changes, document uploads, task creation, AI interaction.
- **Out-of-scope personas**: LPs, target-company executives, advisors from other banks, board observers. These require separate future planning if ever needed.

## 5. Current-State Security Boundary Analysis

### 5.1 The `has_deal_role()` Helper
All Stage 8 RLS policies use `public.has_deal_role(deal_id, roles[])`. This function checks `deal_members` for `auth.uid()` membership and role matching. It is the single security anchor for all business-entity access.

### 5.2 Current Role Permissions (Stage 8 Baseline)

| Table | `lead_advisor` | `advisor` | `viewer` |
|---|---|---|---|
| `deals` | SELECT, INSERT, UPDATE, DELETE | SELECT | SELECT |
| `buyers` | SELECT, INSERT, UPDATE, DELETE | SELECT | **SELECT** |
| `pipeline_stages` | SELECT, INSERT, UPDATE, DELETE | SELECT | **SELECT** |
| `buyer_pipeline_states` | SELECT, INSERT, UPDATE, DELETE | SELECT | **SELECT** |
| `documents` | SELECT, INSERT, UPDATE, DELETE | SELECT, INSERT, UPDATE, DELETE | **SELECT** |
| `communications` | SELECT, INSERT, UPDATE, DELETE | SELECT, INSERT, UPDATE, DELETE | ✗ blocked |
| `tasks` | SELECT, INSERT, UPDATE, DELETE | SELECT, INSERT, UPDATE, DELETE | ✗ blocked |
| `ai_jobs` | ALL | ✗ blocked | ✗ blocked |
| `ai_outputs` | ALL | ✗ blocked | ✗ blocked |
| `deal_members` | SELECT | SELECT | SELECT |

### 5.3 Why `viewer` Is Unsafe for External Users
The `viewer` role was designed for an internal observer (e.g., a junior analyst on the sell-side team). It can:
- **See all buyers**: Names, descriptions, industries, websites of every potential acquirer in the pipeline. An external buyer seeing competitor identities is a critical confidentiality breach.
- **See all pipeline states**: Which buyers are at which stage. This reveals negotiation leverage and deal dynamics to an outsider.
- **See all documents**: Every document uploaded to the deal, including internal working papers, draft analyses, and confidential financial models. There is no `is_public` or `visibility` flag on the `documents` table.
- **See all deal members**: The `deal_members` SELECT policy allows any member (including `viewer`) to list all other members. An external user could enumerate the entire sell-side team.

### 5.4 Current Invite Flow Constraints
- `ALLOWED_INVITE_ROLES` in `src/actions/invite.ts` is hardcoded to `['advisor', 'viewer']`.
- Invite acceptance creates a `deal_members` row via `createAdminClient()`.
- Existing-account acceptance enforces same-org membership (`userProfile.organization_id !== dealData.organization_id` → blocked).
- New-account acceptance assigns the user to the deal's `organization_id` and sets `user_type: 'invited'`.
- There is no concept of an "external" invite distinct from an "internal" invite.

### 5.5 Key Schema Gap
The `documents` table has no external-visibility flag. All documents are visible to all deal members. External document sharing would require an explicit allowlisting mechanism.

## 6. Safe Future External Surface Candidates
The following surfaces may be safely exposed to external principals **after** proper data isolation is implemented:

| Surface | Condition |
|---|---|
| Deal summary (name, description, target_industry) | Only the deal the external user is invited to |
| Documents (subset) | Only documents explicitly marked as external-facing via a future allowlisting mechanism |
| Document download | Server-mediated only, for explicitly approved documents |

## 7. Forbidden External Exposure
The following must **never** be accessible to external principals, regardless of future implementation:

| Surface | Reason |
|---|---|
| `buyers` (all rows) | Competing buyer identities are strictly confidential |
| `pipeline_stages` | Reveals deal structure and negotiation strategy |
| `buyer_pipeline_states` | Reveals which competitors are at which stage |
| `communications` | Internal buyer-interaction logs |
| `tasks` | Internal operational workstream |
| `ai_jobs` | Internal AI processing pipeline |
| `ai_outputs` | Internal AI-generated drafts and analyses |
| `deal_members` (full list) | Internal team composition |
| `deal_invites` | Invitation metadata and email addresses |
| Internal/draft documents | Working papers not approved for external release |
| Dashboard / analytics | Internal performance metrics |
| Activity feeds | Internal event history (if introduced later) |

## 8. Isolation Model Options

### 8.1 Option A: New Role Inside `deal_members`
**Concept**: Add a new `deal_roles` entry (e.g., `external_viewer`) and modify Stage 8 RLS to explicitly exclude `external_viewer` from `buyers`, `pipeline_stages`, `buyer_pipeline_states`, and `deal_members` SELECT policies. Add a document-visibility column and filter documents to only show externally approved ones.

**Security Strengths**:
- Reuses existing `has_deal_role()` helper infrastructure.
- Role-based filtering is already the established pattern.

**Security Weaknesses**:
- **Negative-permission fragility**: Every existing and future RLS policy must be audited and explicitly amended to exclude the external role. Missing one table = data leak. This is a "default-open" approach for new tables.
- **Lateral traversal risk**: The external user is still a `deal_member`, meaning `deal_members` SELECT policy would expose the internal team list unless rewritten.
- **Org-bridge contamination**: The current invite flow assigns external users to the deal's `organization_id`. This grants them `users`/`organizations` table visibility intended only for internal members.

**Impact on Stage 8**: Requires rewriting nearly every Stage 8 policy to add explicit exclusion clauses. Fundamentally weakens the "any member can read" simplicity of the current model.
**Schema Complexity**: Low (one new role row, one new column on `documents`).
**RLS Complexity**: High (every policy must be amended; regression risk is significant).
**Invitation-Flow Impact**: Moderate (must add `external_viewer` to `ALLOWED_INVITE_ROLES`, must remove org-bridge assignment for external invites).
**Future UI Compatibility**: Acceptable, but the portal must carefully filter queries.
**Verdict**: **NOT RECOMMENDED.** The negative-permission model is fragile and inverts the fail-closed principle. Every future table or policy addition becomes a potential leak vector if the developer forgets to exclude the external role.

### 8.2 Option B: Separate External Access Table
**Concept**: Create a new `external_access` (or `buyer_portal_access`) table that maps an auth user directly to a specific `buyers.id` and `deals.id`, entirely outside the `deal_members` system. External users are never added to `deal_members`. A separate set of RLS policies (or a new helper function like `has_external_access()`) governs what external users can read. Documents require an explicit `is_external` boolean column (or a separate `external_documents` junction table).

**Security Strengths**:
- **Fail-closed by default**: External users have zero access to any table governed by `has_deal_role()`, because they are not in `deal_members`. No existing policy needs modification.
- **Positive-permission model**: External access is granted explicitly and additively. New tables default to invisible to external users.
- **No lateral traversal**: External users cannot enumerate other buyers, pipeline states, or deal members because those policies check `deal_members` which excludes them.
- **Clean org boundary**: External users do not need to be assigned to the seller's `organization_id`.

**Security Weaknesses**:
- Requires a new RLS helper function and new policies specifically for external tables/views.
- Document exposure requires an explicit allowlisting mechanism (positive-permission).

**Impact on Stage 8**: None. Existing policies remain untouched.
**Schema Complexity**: Moderate (new table, new column or junction table for document visibility).
**RLS Complexity**: Moderate (new policies only; existing policies untouched).
**Invitation-Flow Impact**: Significant conceptually (external invites must create `external_access` rows instead of `deal_members` rows, and must not assign org membership). However, invite-flow code changes are downstream implementation work.
**Future UI Compatibility**: Strong. External portal routes can query exclusively through the external access layer.
**Verdict**: **RECOMMENDED.** Clean separation, fail-closed default, no regression risk to existing internal access.

### 8.3 Option C: Document-Only Access Links (No Auth)
**Concept**: Skip user-level external access entirely. Instead, generate time-limited, token-based document access URLs. External users never authenticate; they click a secure link to view or download specific documents. No portal, no login, no persistent access.

**Security Strengths**:
- Zero exposure of any database entity to external principals.
- No RLS changes needed; documents are served via server-mediated signed URLs.

**Security Weaknesses**:
- No audit trail of who accessed what (unless the token is logged server-side).
- Link sharing risk (anyone with the URL can access the document within the time window).
- No persistent state: external users cannot return to a "portal" to see updates.
- Does not support a deal summary page or any interactive surface.

**Impact on Stage 8**: None.
**Schema Complexity**: Low (token table or reuse of Supabase storage signed URLs).
**RLS Complexity**: None.
**Invitation-Flow Impact**: None (no invite needed; just a link).
**Future UI Compatibility**: Poor. This is a dead-end for portal evolution.
**Verdict**: **REJECTED for the primary portal direction.** Useful as a complementary mechanism for ad-hoc document sharing, but cannot serve as the foundation for a buyer portal. It does not deliver the strategic value of a persistent external evaluation surface.

## 9. Recommended Direction
**Option B: Separate External Access Table** is the recommended architectural direction.

**Rationale**:
1. **Fail-closed by default**: External users have zero access unless explicitly granted. This is the correct security posture for crossing a trust boundary.
2. **No Stage 8 regression risk**: Existing internal RLS policies remain completely untouched. The `has_deal_role()` helper continues to govern internal access exclusively.
3. **Positive-permission model**: Document exposure requires explicit allowlisting (e.g., an `is_external` flag or a junction table). No document is accidentally visible.
4. **Clean organizational separation**: External users are not assigned to the seller's organization. The `users.organization_id` field and org-scoped residual policies do not create unintended lateral access.
5. **Future-proof**: The external access layer can be extended independently (e.g., adding buyer-specific communication channels, read receipts, or document request workflows) without touching internal CRM policies.

**Key architectural constraints of the recommended direction**:
- Current internal `deal_members` semantics must NOT be reused for external principals.
- A separate external-access isolation model is required.
- Document-level exposure requires explicit allowlisting; the default must be "not visible externally."
- CRM entities (`buyers`, `pipeline_stages`, `buyer_pipeline_states`, `communications`, `tasks`) must remain categorically hidden from external users at the RLS level.

## 10. Required Future RLS Redesign Areas
The following describes the conceptual RLS direction for a future execution stage. No SQL is specified here.

### 10.1 Internal Trust Boundary (Unchanged)
All existing Stage 8 policies using `has_deal_role()` remain exactly as they are. Internal `deal_members` govern internal access. No modifications.

### 10.2 External Trust Boundary (New)
A new helper function (conceptually `has_external_access(deal_id)`) would check the external access table for `auth.uid()` membership.

**Table-by-table external visibility direction**:

| Table | External Access Direction |
|---|---|
| `deals` | SELECT allowed — restricted to the specific deal the user is invited to. Only non-sensitive summary fields (name, description, target_industry). |
| `documents` | SELECT allowed — restricted to documents explicitly marked as external-facing. |
| `buyers` | **BLOCKED** — no external RLS policy. Zero rows returned. |
| `pipeline_stages` | **BLOCKED** — no external RLS policy. Zero rows returned. |
| `buyer_pipeline_states` | **BLOCKED** — no external RLS policy. Zero rows returned. |
| `communications` | **BLOCKED** — no external RLS policy. Zero rows returned. |
| `tasks` | **BLOCKED** — no external RLS policy. Zero rows returned. |
| `ai_jobs` | **BLOCKED** — no external RLS policy. Zero rows returned. |
| `ai_outputs` | **BLOCKED** — no external RLS policy. Zero rows returned. |
| `deal_members` | **BLOCKED** — no external RLS policy. Zero rows returned. |
| `deal_invites` | **BLOCKED** — no external RLS policy. Zero rows returned. |
| `external_access` (new) | SELECT allowed — user can read their own row only. |

### 10.3 Document Visibility Mechanism
Documents require an explicit external-visibility flag or junction table. The conceptual options are:
- **Column-based**: Add `is_external BOOLEAN DEFAULT FALSE` to `documents`. External RLS checks both `has_external_access(deal_id)` AND `is_external = TRUE`.
- **Junction-based**: New `external_documents` table mapping `document_id` to `external_access_id`. External RLS joins through the junction.

The column-based approach is simpler and sufficient for MVP. The junction-based approach offers finer granularity per-external-user but adds schema complexity.

### 10.4 Storage Bucket Isolation
Current Supabase Storage policies on the `vault` bucket allow any authenticated user to read any object. This must be tightened:
- External users should only download files whose corresponding `documents` row is marked external-facing.
- Server-mediated download (via server action + signed URL) is the safest approach, avoiding direct storage policy complexity.

## 11. Required Future Invitation / Access Semantics
The following defines the conceptual invitation model for external principals. Invite-flow code changes are downstream implementation work, not part of this planning stage.

### 11.1 External Invite Principles
- **Invite-only**: No open registration or public signup for external access.
- **Single-deal scope**: Each external invite grants access to exactly one deal.
- **No org inheritance**: External users must NOT be assigned to the seller's `organization_id`.
- **No `deal_members` row**: External invite acceptance must create an `external_access` row, not a `deal_members` row.
- **Email binding**: External invites remain email-bound (consistent with current invite flow).
- **Expiry**: External invites should have configurable expiry (consistent with current 7-day default).
- **Revocability**: The lead_advisor must be able to revoke external access at any time.

### 11.2 Conceptual External Invite Flow
1. Lead advisor creates an external invite (new invite type, distinct from internal invites).
2. System generates a token-bound link.
3. External user registers or logs in via the invite link.
4. On acceptance, system creates an `external_access` row (NOT a `deal_members` row).
5. External user is redirected to a separate external portal route group.

### 11.3 Separation from Internal Invites
The current `ALLOWED_INVITE_ROLES` constant and the `createInvite` function are designed for internal collaboration. External invitations will likely require either:
- A separate action function (e.g., `createExternalInvite`), or
- An `invite_type` discriminator on `deal_invites`.

The exact implementation approach is deferred to the execution stage.

## 12. Explicit NO-GO for Portal UI Before Isolation
**Portal UI execution remains NO-GO.** No external-facing UI routes, components, or pages may be built until:
1. The external access table exists and is populated via a safe invite flow.
2. RLS policies for external access are implemented and verified.
3. Document external-visibility flagging is in place and verified.
4. Storage access for external users is restricted to approved documents.
5. The above are committed, reviewed, and accepted as a separate execution stage.

## 13. Out of Scope
- Portal UI implementation
- Schema migration (DDL)
- SQL policy writing
- Code changes in `src/actions/invite.ts` or `src/utils/roles.ts`
- Public signup flow
- Messaging, negotiation, offer submission
- AI access for external users
- Multi-deal external dashboard
- Buyer-side mutations of any kind

## 14. Acceptance Criteria for This Planning Stage
1. The document clearly states that current `viewer` is internal-only and unsafe for external use.
2. Safe vs forbidden surfaces are explicitly classified for all major tables.
3. At least 3 isolation-model options are analyzed with security strengths/weaknesses.
4. Exactly one architectural direction is recommended.
5. Portal UI remains NO-GO until external isolation is implemented and verified.
6. Invitation semantics are described at the conceptual level without implementation detail.
7. No code, SQL, or schema drift is present in this document.

## 15. Stop Conditions
- STOP if repository evidence contradicts the assumption that `viewer` can read `buyers`/`pipeline_stages`/`documents`.
- STOP if the current trust model is materially different from Stage 8 planning assumptions.
- STOP if any source file changes are made during this planning stage.

## 16. Next Recommended Stage
**STAGE 15A EXECUTION: EXTERNAL ACCESS SCHEMA & RLS IMPLEMENTATION**

This stage would implement the external access table, document visibility flag, new RLS policies, and external invite flow — all as a single security-focused execution stage, without any UI work.

Only after Stage 15A is accepted and verified should portal UI work begin in a subsequent stage (tentatively Stage 15B).
