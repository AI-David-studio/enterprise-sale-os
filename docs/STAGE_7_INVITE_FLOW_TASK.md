# Stage 7 Implementation Task

## 1. STAGE NAME
**Stage 7: Invite Flow + Multi-Participant Access**

## 2. PURPOSE
Stage 7 introduces seller-controlled, invite-based access so that deal participants beyond the original seller can join an existing deal workspace. Stages 1–6 established a fully functional single-seller deal operating system with self-registration, CRM, documents, communications, tasks, AI review, and profile management. Stage 7 extends this by letting the deal owner invite trusted collaborators (advisors, viewers) into a specific deal via a secure token link — without opening public registration for non-seller roles and without creating a buyer portal.

**Problem solved now:** Sellers cannot yet share deal visibility with their advisors or read-only stakeholders. All deal access is limited to the original registrant.

**Why invite-based:** Open public registration for non-seller roles would violate the seller-first control principle. Invite tokens ensure the deal owner explicitly controls who can access what, and membership is always scoped to a specific deal.

## 3. AUTHORITATIVE SCOPE
Stage 7 is strictly limited to:
- Seller-controlled invite creation for an existing deal.
- Server-generated token-based invite link flow.
- Invite acceptance for existing-account and new-account participants.
- Per-deal membership creation via trusted server-side path.
- Support for exactly two new participant roles: `advisor` and `viewer`.
- Minimal role-aware navigation visibility for invited participants.
- Russian-first UI on all new surfaces.

Stage 7 explicitly remains:
- Invite-based only (no open public registration for non-seller roles).
- Seller-controlled (only the deal owner can invite).
- Non-buyer-portal (no buyer-facing authentication or portal).
- Single-deal-first in UI (no deal switcher).
- Russian-first.

## 4. IN-SCOPE ITEMS

### Schema
- New `deal_invites` table (see Section 5).
- New `advisor` and `viewer` rows in `deal_roles` (seeded idempotently in the Stage 7 migration).

### Server Actions
- **Invite creation action** — seller creates an invite for a specific deal + role + email; generates token; stores in `deal_invites`.
- **Invite acceptance action** — validates token, creates `deal_members` row, marks invite as used. Handles both existing-account and new-account flows.

### Routes / Pages
- **Invite acceptance page:** `/invite/[token]` — public route; validates token; shows invite details in Russian; offers login path for existing accounts or an **embedded inline registration form** for new accounts (see Section 7). The `/register` page is NOT reused for invite acceptance — it remains seller-only.
- **Invite creation UI:** Minimal invite form on an existing seller-side deal surface (e.g., within `/deal` page or a dedicated section). Seller selects role (`advisor` or `viewer`), enters invitee email, generates invite link. Display/copy the generated link.

### Role-Aware Navigation
- Hide AI review queue (`/ai-review`) for `advisor` and `viewer` roles.
- Hide communications (`/communications`) and tasks (`/tasks`) for `viewer` role.
- All other protected pages remain visible but read-only for non-seller roles where applicable.

### Token State Handling
- **Valid:** Show invite details, proceed to acceptance.
- **Expired:** Show Russian error "Приглашение истекло. Обратитесь к владельцу сделки."
- **Already used:** Show Russian error "Приглашение уже использовано."
- **Revoked:** Show Russian error "Приглашение отменено."
- **Role changed before acceptance:** Accepted role reflects the latest `role_id` stored on the invite record at the moment of acceptance.

### Stage 6 Compatibility
Stage 6 seller-only self-registration at `/register` remains seller-only and is NOT reused for invite-based registration. Invite acceptance for new accounts uses a **dedicated inline registration form embedded within the `/invite/[token]` page** that:
- Creates the auth account + session (same `signUp()` pattern).
- Skips org/deal/pipeline creation (the deal already exists; the invited user joins it).
- Creates a `public.users` profile row with `user_type = 'invited'` (a global identity marker meaning "joined via invite"). The user's deal-specific role (`advisor`/`viewer`) is stored only in `deal_members.role_id` — NOT in `user_type`.
- Creates exactly one `deal_members` row for the specific invited deal + role.
- Uses trusted server-side provisioning (service-role admin client) for all downstream writes.

### Global Identity vs Deal-Specific Role
**Critical distinction:** `public.users.user_type` represents global identity (`'seller'` for self-registered sellers, `'invited'` for invite-accepted participants). It does NOT carry deal-specific role information. The invited user's per-deal role (`advisor` / `viewer`) is represented exclusively in `deal_members.role_id`. Stage 7 must NOT overwrite or conflate `user_type` with a deal-scoped role name.

## 5. DATA MODEL / SCHEMA REQUIREMENTS

### New Table: `deal_invites`
```sql
CREATE TABLE public.deal_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.deal_roles(id) ON DELETE RESTRICT,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  -- status values: 'pending', 'accepted', 'expired', 'revoked'
  invited_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  accepted_by uuid REFERENCES public.users(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.deal_invites ENABLE ROW LEVEL SECURITY;
```

### Invite Token Lifecycle States
| Status | Meaning | Trigger | Audit Fields Set |
|---|---|---|---|
| `pending` | Awaiting acceptance | Invite created | `created_at`, `expires_at` |
| `accepted` | Used successfully | Invited user accepts | `accepted_at`, `accepted_by` |
| `expired` | Time-expired | `expires_at < now()` checked on access | (status updated lazily on next token lookup) |
| `revoked` | Cancelled by seller | Seller revokes | `revoked_at` |

**Revoked-state realism (Stage 7 MVP):** The `revoked` status and `revoked_at` column are reserved in the schema for future use and must be handled gracefully if encountered (i.e., token lookup shows Russian error "Приглашение отменено"). However, Stage 7 MVP does NOT require a user-facing revocation UI or server action to produce the `revoked` state. Revocation can be performed manually via direct database update or deferred to a later stage. Acceptance criteria do NOT require testing revocation as a user-initiated runtime flow.

### Invite RLS / Privacy
Invite records contain sensitive metadata (invitee emails, pending invitations). Broad read access to all deal members would leak this information to advisors and viewers.

**RLS policy:** Only the invite creator (seller) may read invite records via client-side queries. All other invite operations (token validation, acceptance) are handled through trusted server-side actions using the admin client, which bypasses RLS.

```sql
-- Only the invite creator can view their own invites
CREATE POLICY "Invite creators can view their own invites" ON public.deal_invites
  FOR SELECT USING (invited_by = auth.uid());
```

**Token lookup for acceptance** is performed server-side via `createAdminClient()` — not via anonymous or authenticated client direct reads. This ensures that unauthenticated users on `/invite/[token]` can validate tokens without requiring a public RLS SELECT policy on `deal_invites`.

### Token Requirements
- Token must be a cryptographically random string (e.g., 48 hex characters via `crypto.randomUUID()` + additional entropy).
- Token column has a `UNIQUE` constraint for fast lookup.
- Default expiry: 7 days from creation.

### New `deal_roles` Rows
The migration must seed exactly two new roles if they do not already exist:
- `advisor` — description: "Консультант сделки (чтение + документы)"
- `viewer` — description: "Наблюдатель (только чтение)"

Use `INSERT ... ON CONFLICT DO NOTHING` or equivalent idempotent pattern (similar to Stage 6 `lead_advisor` reuse logic).

### Relationship Summary
- `deal_invites.deal_id` → `deals.id`
- `deal_invites.role_id` → `deal_roles.id`
- `deal_invites.invited_by` → `users.id` (the seller who created the invite)
- `deal_invites.accepted_by` → `users.id` (nullable; set on acceptance)
- Acceptance creates a row in `deal_members` (`deal_id`, `user_id`, `role_id`)

## 6. ROLE / PERMISSION MODEL

### Seller / Owner Authority Definition
**Who can invite in Stage 7:** A user is authorized to create invites for a deal if and only if they are a member of that deal with `deal_roles.name = 'lead_advisor'` (the seller-owner role established during Stage 6 registration). This is the sole authority basis.

- `advisor` and `viewer` roles may NOT create invites.
- Global `user_type` is NOT consulted for invite authority. Authority is determined exclusively by `deal_members.role_id` → `deal_roles.name`.
- Stage 7 does NOT introduce a separate "owner" or "admin" role. The existing `lead_advisor` role is the seller-owner role for all Stage 7 purposes.

### MVP Permission Matrix

| Capability | `lead_advisor` (seller/owner) | `advisor` | `viewer` |
|---|---|---|---|
| Dashboard — view | ✅ | ✅ | ✅ |
| Deal details — view | ✅ | ✅ | ✅ |
| Deal details — edit | ✅ | ❌ | ❌ |
| Buyers list/detail — view | ✅ | ✅ | ✅ |
| Buyers — create/edit | ✅ | ❌ | ❌ |
| Pipeline board — view | ✅ | ✅ | ✅ |
| Pipeline board — edit | ✅ | ❌ | ❌ |
| Documents — view/download | ✅ | ✅ | ✅ |
| Documents — upload | ✅ | ❌ | ❌ |
| Communications — view | ✅ | ✅ | ❌ (hidden) |
| Communications — create | ✅ | ❌ | ❌ |
| Tasks — view | ✅ | ✅ | ❌ (hidden) |
| Tasks — create/edit | ✅ | ❌ | ❌ |
| AI review queue | ✅ | ❌ (hidden) | ❌ (hidden) |
| Profile (own) — edit | ✅ | ✅ | ✅ |
| Invite participants | ✅ | ❌ | ❌ |

### Enforcement Strategy (Stage 7 MVP)
- **Navigation visibility:** Hide nav links for hidden capabilities based on the current user's `deal_members.role_id` for the active deal. This is the primary Stage 7 enforcement mechanism.
- **Server-side guards:** Server actions for write operations (create buyer, upload document, create task, create invite, etc.) must verify the calling user's role via `deal_members` + `deal_roles` lookup before allowing mutations. If role lacks permission, return Russian error.
- **RLS-level enforcement:** Deferred to Stage 8. Stage 7 focuses on app-level role checks. Existing RLS (organization-scoped SELECT, deal-member-scoped SELECT) remains in place.

## 7. INVITE ACCEPTANCE FLOW

### Route: `/invite/[token]`
This route is public (added to middleware allowlist alongside `/login` and `/register`).

### Flow Logic:
1. **Token lookup (server-side):** Fetch `deal_invites` row by `token` via server action using `createAdminClient()`. If not found → show "Приглашение не найдено".
2. **Status check:** If `status != 'pending'` → show appropriate Russian error per status.
3. **Expiry check:** If `expires_at < now()` → update status to `'expired'`, show "Приглашение истекло".
4. **Display invite info:** Show deal name, role label (in Russian), inviter name. All in Russian.
5. **Email verification:** The accepting user's email must match `deal_invites.email` (case-insensitive, trimmed). If a logged-in user's email does not match, block acceptance with Russian error: "Это приглашение предназначено для другого адреса электронной почты." Stage 7 must NOT allow arbitrary authenticated users to accept someone else's invite token.
6. **Auth check — three paths:**
   - **User already logged in (email matches):** Show "Принять приглашение" button. On click → create `deal_members` row via trusted server-side action → mark invite as `'accepted'` (set `accepted_at`, `accepted_by`) → redirect to `/dashboard`.
   - **User not logged in, has account:** Show "Войти и принять" link → redirect to `/login?redirect=/invite/[token]` → after login, browser returns to invite page → email match check (step 5) → user clicks "Принять приглашение" → same acceptance as above.
   - **User not logged in, no account:** The `/invite/[token]` page renders an **inline registration form** (email pre-filled from invite and **locked / non-editable** for MVP, password, first name, last name). This form calls a dedicated `acceptInviteWithNewAccount` server action that: (a) creates auth account + session via `signUp()` using the invite email, (b) creates `public.users` profile with `user_type = 'invited'` (NOT the deal role name), (c) creates `deal_members` row, (d) marks invite as `'accepted'`. The seller-only `/register` page is NOT involved.
7. **Membership creation:** Insert `deal_members` row with `deal_id` from invite, `user_id` from authenticated user, `role_id` from invite record (latest value at moment of acceptance). Run via trusted server-side path only (`createAdminClient()`).
8. **Profile semantics for new accounts:** New invited users receive `user_type = 'invited'` in `public.users`. They are NOT assigned their own organization or deal — they join the existing deal only. Their `organization_id` in `public.users` is set to the deal's organization (so existing org-scoped RLS policies grant them read access). Their deal-specific role (`advisor`/`viewer`) lives exclusively in `deal_members.role_id`.

### Org-Scoped Access Safety
> [!WARNING]
> Setting `organization_id` on the invited user's profile is a **pragmatic MVP compatibility bridge** so that existing org-scoped RLS SELECT policies (established in Stages 1–2) grant the invited user read access to deal-related data. This is safe only under the current **single-deal-first / one-active-deal** operating assumption already established in earlier stages. If runtime review during execution reveals that this org association exposes data beyond the invited deal (e.g., unrelated deals, other org members' private data), execution must **STOP and report** rather than silently over-grant access. Stage 8 (RLS-level permission enforcement) is the designated place for stricter per-role / per-membership RLS hardening.

### Idempotency / Duplicate-Membership Rules
The invite acceptance flow must be idempotent:
- Before inserting a `deal_members` row, the implementation must check for an existing membership with the same `(deal_id, user_id)`. If membership already exists, skip the insert and treat the invite as successfully accepted.
- A `deal_invites` row that is already `'accepted'` must not create a second membership row on retry or race. The token lookup catches this via the status check (step 2).
- If the seller creates a new invite for the same `(deal_id, email, role_id)` combination while a `'pending'` invite already exists, the implementation must either reuse the existing pending invite (return its token) or reject the duplicate with a clear Russian message. Do NOT allow unbounded duplicate pending invites for the same deal + email.

### Partial-Failure Handling
- If membership creation fails after invite status update → revert invite status to `'pending'` so the user can retry.
- If profile creation fails for new accounts → delete the auth user (same compensating cleanup pattern as Stage 6).
- If `deal_members` insert fails after profile creation → delete `public.users` row + auth user → revert invite to `'pending'`.

## 8. ROUTES / UI REQUIREMENTS

### New Routes
| Route | Type | Auth | Purpose |
|---|---|---|---|
| `/invite/[token]` | Public | No | Invite acceptance page (includes inline registration for new accounts) |

### Modified Surfaces
| Surface | Change |
|---|---|
| `/deal` (or new section) | Add invite creation form (seller only): email input, role selector (advisor/viewer), generate button, copy-link display |
| `layout.tsx` | Role-aware nav visibility: hide items per permission matrix |
| `middleware.ts` | Add `/invite` to public route allowlist |

### No New Protected Routes
Invited participants use the same existing protected pages (`/dashboard`, `/deal`, `/buyers`, `/pipeline`, `/documents`, `/communications`, `/tasks`, `/profile`). Stage 7 only gates visibility and write access by role.

## 9. AUTH / SECURITY REQUIREMENTS
- Invite tokens must be server-generated using cryptographically secure randomness.
- No open public registration for non-seller roles outside the invite acceptance flow. The `/register` page remains seller-only.
- Deal membership must be created only through trusted server-side path (service-role admin client). The invite acceptance action must use `createAdminClient()`.
- The intended product boundary is **deal-specific access only** for invited users. However, Stage 7 MVP temporarily relies on an organization-scoped compatibility bridge (see Section 7, Org-Scoped Access Safety). Broader org-level exposure is NOT intended. If runtime review during execution shows the org bridge exposes unrelated data beyond the invited deal, execution must STOP and report.
- `SUPABASE_SERVICE_ROLE_KEY` must not be exposed to client code. All privileged operations remain in `'use server'` actions.
- Token must not be guessable. Minimum 32 bytes of entropy.
- Expired/revoked tokens must not grant access under any circumstances.

## 10. OUT-OF-SCOPE (FORBIDDEN)
- Buyer portal or buyer-facing authentication flow.
- Open public registration for non-seller roles.
- Email delivery infrastructure (SMTP, Resend, SendGrid) — seller copies and sends the invite link manually.
- Org-level team management / admin panel.
- Multi-deal dashboard / deal switcher UI.
- Role matrix editor UI.
- RLS-level permission enforcement (deferred to Stage 8).
- Document-level sharing permissions per participant.
- Notification center (email or in-app).
- Invite revocation management UI or server action (revoked state is schema-reserved only; manual DB revocation is sufficient for MVP).
- SAML/SSO for invited participants.
- Internal team member role.
- Legal/financial reviewer roles.
- `buyer_representative` role.
- Broader collaboration platform behaviors.
- Browser-based E2E verification.

## 11. FILES EXPECTED TO CHANGE

### New Files
- `supabase/migrations/2026MMDD_stage_7_invites.sql` — `deal_invites` table + role seeding.
- `src/actions/invite.ts` — Server actions for invite creation and acceptance.
- `src/app/(auth)/invite/[token]/page.tsx` — Invite acceptance page.

### Modified Files
- `src/app/(protected)/deal/page.tsx` — Add invite creation section (seller only).
- `src/app/(protected)/layout.tsx` — Role-aware nav visibility.
- `src/utils/supabase/middleware.ts` — Add `/invite` to public routes.
- Possibly: a shared role-checking utility (e.g., `src/utils/roles.ts`).

### Expected Unchanged Files
The following files are expected to remain unchanged, but implementation may require minimal adjustments if invite-return redirect handling reveals gaps:
- `src/app/(auth)/register/page.tsx` — Remains seller-only. NOT reused for invite acceptance.
- `src/app/(auth)/login/page.tsx` — Expected unchanged. If redirect-after-login to `/invite/[token]` requires a query-param handler, a minimal change may be needed.
- `src/utils/supabase/admin.ts` — Reused as-is.
- `src/actions/register.ts` — Unchanged; seller-only registration flow stays intact.

## 12. ACCEPTANCE CRITERIA
Stage 7 is successful only if all the following are true:
1. Seller (deal owner) can create an invite for `advisor` or `viewer` role for a specific deal.
2. Invite generates a unique token-based link that can be copied.
3. Token-based invite acceptance works for users who already have an account (login → accept).
4. Token-based invite acceptance works for users who do not yet have an account (register → accept).
5. Acceptance creates exactly one `deal_members` row for the invited deal + role.
6. Invite acceptance is bound to the invited email: only an account whose email matches `deal_invites.email` (case-insensitive) can accept. Mismatched emails are rejected with a clear Russian error.
7. Expired, used, and revoked invites are rejected with clear Russian error messages.
8. Invited `advisor` can see dashboard, deal, buyers, pipeline, documents, communications, tasks — but cannot edit or create.
9. Invited `viewer` can see dashboard, deal, buyers, pipeline, documents — but communications, tasks, and AI queue are hidden.
10. AI review queue is hidden for all non-seller roles.
11. Only sellers can create invites. Advisor and viewer cannot invite others.
12. No buyer portal, open public non-seller registration, or email delivery infra is introduced.
13. `/register` remains seller-only self-registration.
14. All new UI surfaces are Russian-first.
15. Stages 1–6 remain intact and functional.
16. The Stage 7 migration applies cleanly without breaking existing data.
17. Membership creation uses trusted server-side provisioning only.

## 13. REGRESSION / SAFETY
Stage 7 execution must NOT break:
- Stage 1: Auth foundation, RLS, identity schema.
- Stage 2: CRM / pipeline / buyer management.
- Stage 3: Documents, communications, tasks.
- Stage 4: AI review queue boundaries.
- Stage 5: Dashboard metrics and wiring.
- Stage 6: Seller self-registration, profile page, middleware, navigation.

## 14. STOP CONDITIONS
Stop immediately and report if:
- The invite acceptance flow cannot be implemented without a major auth redesign.
- Membership creation cannot use trusted server-side provisioning safely.
- Role-aware navigation requires a layout rewrite that would break Stages 1–6.
- The `deal_invites` table conflicts with existing schema constraints.
- Implementation drifts into buyer portal, email delivery, or notification system territory.
- Browser-based proof would be required to validate a claim.

## 15. RECOMMENDED IMPLEMENTATION PHASING
- **Stage 7A — Schema + Backend:** Migration (`deal_invites` table, role seeding), invite creation server action, invite acceptance server action, role-checking utility.
- **Stage 7B — Invite UI:** Invite creation form on deal page (seller only), invite acceptance page (`/invite/[token]`), middleware update.
- **Stage 7C — Role-Aware Navigation:** Layout nav visibility per role, server-side write guards on existing mutation actions.

## 16. HANDOFF TO NEXT STAGE
Upon acceptance of Stage 7, the project may proceed to:
**Stage 8 Planning: RLS-Level Permission Enforcement** — hardening the role/permission model with database-level RLS policies so that server-side app-level guards are backed by fail-closed row-level security.
