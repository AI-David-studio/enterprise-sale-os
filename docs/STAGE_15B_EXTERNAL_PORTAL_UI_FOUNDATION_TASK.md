# Stage 15B — External Portal UI Foundation

## 1. Purpose

Build the **first safe external-facing UI** on top of the accepted Stage 15A security isolation layer.
External users (buyer-side evaluators) must be able to accept invitations, authenticate, and view/download allowlisted documents — without accessing any seller-internal CRM surfaces.

## 2. Why Stage 15B Comes After Stage 15A

Stage 15A established the security foundation:
- `external_access` table (separate from `deal_members`)
- `external_invites` table (separate from `deal_invites`)
- `has_external_access()` helper + external document RLS
- `is_external` allowlisting on `documents`
- Trust-purity guards in `external-invite.ts`
- Storage hardening (dropped broad vault policies)

Stage 15B builds **only** the UI that this accepted security layer can safely support.

## 3. Audit of Current External-Ready Backend Capabilities

| Capability | Status | Evidence |
|---|---|---|
| External invite creation | ✅ Action exists | `createExternalInvite()` in `external-invite.ts` |
| External invite acceptance | ✅ Action exists | `acceptExternalInvite()` in `external-invite.ts` |
| External access revocation | ✅ Action exists | `revokeExternalAccess()` in `external-invite.ts` |
| External access RLS | ✅ Migration applied | `has_external_access()` helper + policies |
| Document `is_external` flag | ✅ Column exists | `documents.is_external BOOLEAN DEFAULT FALSE` |
| External document SELECT | ✅ RLS policy exists | `is_external = TRUE AND has_external_access(deal_id)` |
| External document download | ❌ **BLOCKED** | `getDocumentDownloadUrlAction` uses `getCurrentUserActiveDealContext` → requires org membership |
| External deal summary read | ❌ **BLOCKED** | No external SELECT policy on `deals` table |
| External invite acceptance UI | ❌ **MISSING** | Zero UI call sites for `acceptExternalInvite` |
| External route group | ❌ **MISSING** | Only `(auth)` and `(protected)` groups exist |

## 4. Audit of UI Blockers

### Blocker 1: Document Download Path
`getDocumentDownloadUrlAction` (document.ts L180-238) calls `getCurrentUserActiveDealContext(user.id)` which resolves through `users.organization_id → deals → deal_members → role`. External users have `organization_id = NULL` and are not in `deal_members`, so this function returns `null` for them and the download fails.

**Resolution for Stage 15B**: Create a new `getExternalDocumentDownloadUrlAction` that authorizes via `has_external_access` checks instead of `getCurrentUserActiveDealContext`.

### Blocker 2: Deal Summary Access
No external SELECT policy exists on the `deals` table. External users cannot read any deal fields via RLS.

**Resolution**: Deal summary is **EXCLUDED** from Stage 15B. If needed later, it requires a new RLS policy or a server-mediated read action with explicit field allowlisting.

### Blocker 3: External Invite Acceptance UI
The existing internal invite page at `(auth)/invite/[token]/page.tsx` uses `validateInviteToken` from `src/actions/invite.ts` — the *internal* invite flow. It cannot be reused for external invites.

**Resolution for Stage 15B**: Create a new external invite acceptance page at `(auth)/external-invite/[token]/page.tsx`.

### Blocker 4: External Layout / Route Guard
The `(protected)/layout.tsx` uses `getCurrentUserActiveDealContext` for nav visibility. External users would get no nav items and would be redirected to `/dashboard` (a seller-only page).

**Resolution for Stage 15B**: Create a new `(external)` route group with its own minimal layout that does not depend on `getCurrentUserActiveDealContext`.

## 5. Trust-Boundary Constraints (Carried from Stage 15A)

- External principals are NOT `deal_members`
- No reuse of `viewer` role for external
- No CRM table visibility (buyers, pipeline, communications, tasks, AI)
- No direct storage reads from client
- All downloads remain server-mediated via admin client signed URLs
- No mutation capabilities for external users (read-only)
- External users cannot see `is_external = FALSE` documents
- No seller dashboard/deal/profile pages accessible to external users

## 6. Locked Stage 15B Scope

### DECISION 1 — Deal Summary: **EXCLUDED**
No safe backend read path exists. The `deals` table has no external SELECT policy. Adding one would require carefully allowlisting only safe fields, which is beyond Stage 15B's bounded scope. Deferred to Stage 15C+.

### DECISION 2 — Download Path: **NEW EXTERNAL-SPECIFIC ACTION REQUIRED**
`getDocumentDownloadUrlAction` is NOT reusable. Stage 15B must create `getExternalDocumentDownloadUrlAction` that:
1. Authenticates the caller via `supabase.auth.getUser()`
2. Fetches the document via admin client
3. Verifies `is_external = TRUE` on the document
4. Verifies `has_external_access` for the user on that deal (via admin query)
5. Generates a signed URL via admin client
6. Does NOT use `getCurrentUserActiveDealContext`

### DECISION 3 — Route Structure: **SEPARATE `(external)` ROUTE GROUP**
A new `(external)` route group will be created alongside `(auth)` and `(protected)`:
- `src/app/(external)/layout.tsx` — minimal external layout (no seller nav)
- `src/app/(external)/portal/page.tsx` — external documents page
- `src/app/(auth)/external-invite/[token]/page.tsx` — external invite acceptance (in auth group, does not require pre-existing session)

## 7. Locked In-Scope Items

| Item | Type | Description |
|---|---|---|
| `(auth)/external-invite/[token]/page.tsx` | NEW page | External invite acceptance + registration |
| `(auth)/external-invite/[token]/external-invite-client.tsx` | NEW component | Client component for acceptance form |
| `(external)/layout.tsx` | NEW layout | Minimal external layout (auth gate, no seller nav) |
| `(external)/portal/page.tsx` | NEW page | External documents listing (allowlisted only) |
| `(external)/portal/external-download-button.tsx` | NEW component | Download button calling external-specific action |
| `src/actions/external-document.ts` | NEW action | `getExternalDocumentDownloadUrlAction` |
| External empty/revoked/no-access states | NEW UI | Error and access-denied states |

## 8. Explicit Out-of-Scope

| Item | Reason |
|---|---|
| Deal summary / deal details page | No safe backend read path (no external SELECT on `deals`) |
| Messaging / communications | CRM-internal |
| Offer submission | Mutation + CRM |
| NDA workflow | Not designed |
| Dashboard / analytics | Seller-only |
| AI access | Seller-only |
| Buyer mutations | Read-only external model |
| Multi-deal portal | Single-deal MVP |
| Seller-side external invite management UI | Deferred to Stage 15C+ |
| Changes to internal `invite.ts` | Scope locked |
| Changes to internal `roles.ts` | Scope locked |
| Changes to internal `document.ts` | Scope locked |
| New migrations / schema changes | Stage 15A schema is sufficient |
| Styling redesign | Not in scope |

## 9. Required Backend Dependencies for Stage 15B Execution

| Dependency | Status | Action |
|---|---|---|
| `acceptExternalInvite()` | ✅ Exists | No changes needed |
| `getExternalDocumentDownloadUrlAction` | ❌ Missing | Must create in `src/actions/external-document.ts` |
| External document listing query | ❌ Missing | Server component query via admin client with `is_external = TRUE + has_external_access` check |
| External auth gate (layout) | ❌ Missing | Must create in `(external)/layout.tsx` |

## 10. Acceptance Criteria

Stage 15B is DONE only if all are true:

1. External invite acceptance page exists and calls `acceptExternalInvite()`
2. External invite acceptance handles: valid pending, expired, revoked, used, email mismatch states
3. New `(external)` route group exists with minimal layout
4. External documents page shows only `is_external = TRUE` documents for the user's granted deal
5. External download works via new `getExternalDocumentDownloadUrlAction`
6. No seller nav/layout leaks into external pages
7. No CRM data visible to external users
8. `npm run build` passes
9. No changes to internal `invite.ts`, `roles.ts`, or `document.ts`
10. No new migrations

## 11. Stop Conditions

STOP Stage 15B execution if any of the following:
1. External document download cannot be safely implemented without modifying internal `document.ts`
2. External listing requires a new SELECT policy beyond what Stage 15A provides
3. Route structure would require reusing `(protected)` layout assumptions
4. Implementation drifts into CRM visibility or deal summary

## 12. Verification Plan

### Build Verification
- `npm run build` — must pass with exit code 0

### Static Verification
- `grep -R "getCurrentUserActiveDealContext" src/app/(external)` — must return zero results
- `grep -R "deal_members" src/app/(external)` — must return zero results
- `grep -R "acceptExternalInvite" src/app/(auth)/external-invite` — must return results
- `git diff HEAD --name-only` — must show only new files in `(external)`, `(auth)/external-invite`, and `src/actions/external-document.ts`

### Manual Verification
- External routes do not render seller navigation
- External documents page shows empty state when no `is_external` documents exist

## 13. Recommended Next AG File

```
STAGE 15B EXECUTION: EXTERNAL PORTAL UI FOUNDATION
```
