# Stage 15C — Seller-Side External Access Management UI

## 1. Purpose

Add the seller-side management surface for the external-access lifecycle:
creating, viewing, and revoking external invites and access grants.
This completes the operational loop so internal `lead_advisor` users can
actually operate the Stage 15A security model through the product UI.

## 2. Why Stage 15C Comes After 15B

| Stage | What It Delivered |
|---|---|
| 15A | Security isolation layer (tables, RLS, actions, trust separation) |
| 15B | External buyer portal UI (invite acceptance, documents, download) |
| 15C | Seller-side management surface for the external-access system |

Without 15C, the backend actions `createExternalInvite` / `revokeExternalAccess`
exist but have zero UI call sites on the seller side. The system is technically
capable but operationally incomplete.

## 3. Audit of Current Backend Capabilities

| Action | Signature | Auth | Status |
|---|---|---|---|
| `createExternalInvite` | `(dealId, email) → { success, inviteLink, token }` | lead_advisor | ✅ Exists, no UI |
| `acceptExternalInvite` | `(token, password?, firstName?, lastName?) → { success }` | external | ✅ Has UI (Stage 15B) |
| `revokeExternalAccess` | `(accessId, dealId) → { success }` | lead_advisor | ✅ Exists, no UI |

| Table | Purpose | Seller Visibility |
|---|---|---|
| `external_invites` | Invite lifecycle (pending/accepted/expired/revoked) | Readable by lead_advisor via RLS |
| `external_access` | Active access grants | Readable by granted user; needs admin query for seller |

### Key Finding: Deal Page Pattern
`deal/page.tsx` already renders `InviteSection` (internal invites) for lead_advisor.
The same pattern can be extended to add an external invite section on the same page.

## 4. Locked MVP Persona

**lead_advisor only.** All management actions (create invite, view, revoke)
restricted to lead_advisor of the active deal. Advisor and viewer roles see nothing.

## 5. Locked Stage 15C Scope

### Where the UI Lives
**On the existing deal page** (`src/app/(protected)/deal/page.tsx`),
as a new section below the existing internal invite section.
Separate from external portal. No new top-level nav item.

### UI Surface

| Component | Description |
|---|---|
| **External invite form** | Email input + submit button. Calls `createExternalInvite(dealId, email)`. Shows invite link on success (copy pattern from existing `InviteSection`). |
| **External invites table** | Lists `external_invites` for current deal. Shows: email, status badge (pending/accepted/expired/revoked), created date. No actions — view-only. |
| **Active access table** | Lists active `external_access` rows for current deal. Shows: user email (joined from users), granted date. Revoke button per row. |
| **Revoke action** | Calls `revokeExternalAccess(accessId, dealId)`. Revalidates page on success. |

### Decisions Locked

| Decision | Resolution |
|---|---|
| Where does the UI live? | On `deal/page.tsx`, new section below internal invite section |
| Single page or split? | Single page, two subsections (invites + access grants) |
| Are accepted invites visible? | Yes, shown with "accepted" badge. Read-only. |
| Does revoke change invite display? | No. Revoke acts on `external_access` only. Invite stays with its own status. |
| Can seller see `is_external` doc flag here? | No. Document allowlisting remains on the documents page. |
| Create invite form: modal or inline? | Inline form (same pattern as existing `InviteSection`). |

## 6. In-Scope Files

| File | Type | Description |
|---|---|---|
| `src/app/(protected)/deal/external-invite-section.tsx` | NEW | External invite form + invite listing + access listing + revoke |
| `src/app/(protected)/deal/page.tsx` | MODIFY | Add `ExternalInviteSection` below existing `InviteSection`, pass `dealId` |

**Total: 1 new file, 1 modified file.**

### Backend Dependencies (Already Exist — NOT Modified)
- `src/actions/external-invite.ts` — `createExternalInvite`, `revokeExternalAccess`
- Stage 15A RLS policies for `external_invites` (lead_advisor SELECT)

## 7. Security / Trust Boundary Carry-Over

- External principals remain NOT in `deal_members`
- No viewer role reuse for external
- No CRM data visible to externals
- No seller UI leakage into external portal
- No Stage 15A schema changes
- No Stage 15B portal changes
- Seller-side queries for external_invites / external_access use admin client
  (same pattern as deal page's internal queries)
- lead_advisor role check via `getUserDealRole` (same as deal page pattern)

## 8. Explicit Out-of-Scope

| Item | Reason |
|---|---|
| New migrations / schema | Stage 15A schema is sufficient |
| Stage 15A security redesign | Accepted |
| Stage 15B portal changes | Accepted |
| `is_external` document toggle UI | Deferred (separate documents-page concern) |
| Bulk invite | Not in MVP |
| External messaging / NDA | Not designed |
| Deal summary for externals | Not in scope |
| Seller analytics / dashboard expansion | Stage 16 territory |
| Changes to `external-invite.ts` | Already complete |
| Changes to `roles.ts` or `invite.ts` | Not needed |
| New nav items | Not needed — lives on existing deal page |

## 9. Acceptance Criteria

Stage 15C is DONE only if:

1. `external-invite-section.tsx` exists with external invite form + listing + revoke
2. `deal/page.tsx` renders `ExternalInviteSection` for `lead_advisor`
3. External invite creation works via UI (calls `createExternalInvite`)
4. Invite link is displayed and copyable after creation
5. External invites list shows: email, status, date
6. Active external access grants list shows: email, date, revoke button
7. Revoke action calls `revokeExternalAccess`
8. No new migrations
9. No external portal route changes
10. No CRM leakage
11. `npm run build` passes
12. `git diff HEAD --name-only` shows only the 2 files above
13. No changes to `external-invite.ts`, `document.ts`, `invite.ts`, `roles.ts`

## 10. Stop Conditions

STOP execution if:
1. Required UI depends on new schema changes
2. Required UI depends on modifying Stage 15A trust model
3. Listing external_invites requires new RLS policies beyond accepted Stage 15A
4. Listing external_access user emails requires unsafe joins
5. Implementation drifts into Stage 16 analytics/workflow

## 11. Verification Plan

### Build Verification
- `npm run build` — exit code 0

### Static Verification
- `grep -R "createExternalInvite" src/app/(protected)/deal/external-invite-section.tsx` — must match
- `grep -R "revokeExternalAccess" src/app/(protected)/deal/external-invite-section.tsx` — must match
- `git diff HEAD --name-only` — exactly 2 files

## 12. Next Recommended Step

```
STAGE 15C EXECUTION — SELLER-SIDE EXTERNAL ACCESS MANAGEMENT UI
```
