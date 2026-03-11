# Stage 6 Implementation Task

## 1. STAGE NAME
**Stage 6: Registration + Profile Foundation**

## 2. STAGE OBJECTIVE
The objective of Stage 6 is to introduce **seller-only self-registration** and a user profile management surface ("Мой профиль") to the existing seller-first M&A OS. This stage adds the ability for a new seller to create an account, organization, and deal workspace through a streamlined onboarding form, and provides authenticated users with an editable profile page including password change. The stage preserves strict seller-first boundaries: no buyer portal, no invite flow UI, no multi-user collaboration, no participant-type selection.

## 3. IN-SCOPE FOR STAGE 6
- **Seller Self-Registration (seller-only — no other participant types):**
  - A `/register` page accessible from the login screen via a "Зарегистрироваться" link.
  - Registration form collecting: email, password, first name, last name, organization name, job title (optional), phone (optional).
  - **There is no participant-type picker.** All self-registered users are assigned `user_type = 'seller'` automatically. Buyer, advisor, intermediary, or any other non-seller registration is strictly deferred to invite-based phases.
  - **Auth-session creation and workspace provisioning are distinct concerns.** The implementation must treat them separately:
    - **Auth account + browser session:** The user's auth account may be created via normal `supabase.auth.signUp()` in the request context, which also establishes the authenticated browser session needed for immediate dashboard access. This is the user-facing signup step.
    - **Workspace provisioning (trusted server-side only):** All downstream record creation (`organizations`, `public.users`, `deals`, `pipeline_stages`, `deal_members`, and any `deal_roles` lookup/creation) must execute through a **separate trusted server-side path** — either a Supabase RPC function with `SECURITY DEFINER`, a Supabase client initialized with the service-role key on the server, or equivalent privileged mechanism. The implementation must NOT rely on the freshly signed-up user's client-side session or client-side Supabase client to perform these inserts under standard RLS, since the new user is not yet associated with an organization or deal at the point of creation.
    - **Service-role credentials must never be exposed to the client.** All service-role operations must execute exclusively in server-side code (Server Actions, API Routes, or edge functions).
    - **A pure service-role `admin.createUser()` flow does NOT automatically yield a logged-in browser session.** If the implementation uses service-role admin user creation instead of client-side `signUp()`, it must separately establish the user's browser session (e.g., via `signInWithPassword()` after creation). The chosen approach must be explicitly documented during implementation.
  - **Partial-failure handling:** The registration orchestration must handle failure atomically or with explicit compensating logic. If the auth user is created but downstream provisioning inserts fail, the implementation must either: (a) wrap all dependent writes in a single atomic transaction where possible, or (b) implement compensating cleanup that removes the orphaned auth user and any partial records, or (c) implement an explicit incomplete-registration state that the user can retry. Orphaned auth accounts with no corresponding workspace data are not acceptable.
  - Error handling with Russian-language validation messages.
- **Email Confirmation Decision (MVP):**
  - **Email confirmation is disabled for this MVP registration flow.** Supabase Auth email confirmation must be turned off (or the project must be configured to auto-confirm), so that the user is immediately authenticated and redirected to `/dashboard` after successful registration. A "confirm your email" intermediate state is deferred to a future hardening phase.
  - **Operational prerequisite:** This is an environment-level setting in the Supabase project dashboard (Authentication → Settings → Email → "Confirm email"). The UI code cannot silently guarantee this behavior. **Stage 6 execution must verify that auto-confirm is enabled in the target Supabase project before proceeding.** If the setting is not configured accordingly, execution must stop and report the misconfiguration instead of assuming immediate dashboard access will work.
- **Schema Extension:**
  - Add `phone text` column to `public.users`.
  - Add `job_title text` column to `public.users`.
  - Add `user_type text not null default 'seller'` column to `public.users`.
- **Profile Page ("Мой профиль"):**
  - New `/profile` route within the protected shell.
  - **Scope is strictly personal profile data and password change.** This page does NOT provide any access control, deal membership, role assignment, or organization switching functionality.
  - Display and edit: first name, last name, phone, job title.
  - Display only: email, organization name, user type (role label).
  - Password change form using Supabase Auth `updateUser({ password })`.
  - Success/error feedback in Russian.
- **Navigation Update:**
  - Add "Мой профиль" link to the protected layout header (near the "Выйти" button).
- **Middleware Update:**
  - Allow unauthenticated access to `/register` route (same treatment as `/login`).
- **Russian-First UI:**
  - All new surfaces, labels, buttons, validation messages, and empty states must be in Russian.

## 4. OUT-OF-SCOPE FOR STAGE 6 (FORBIDDEN)
- Buyer portal or buyer self-registration.
- Advisor, intermediary, legal, or financial reviewer self-registration.
- Participant-type picker or role selector on registration form.
- Invite flow UI (invite generation, invite acceptance, invite-code registration).
- Multi-user internal team collaboration.
- `internal_team` role operational features.
- Role-based permission matrix enforcement in UI.
- Email change flow.
- Email confirmation intermediate state (MVP uses auto-confirm).
- Avatar / photo upload.
- Session management or active sessions list.
- Two-factor authentication.
- Notification preferences.
- Preferred language selector.
- Deal access summary on profile.
- Changing deal membership, role assignments, or organization from the profile page.
- Advanced onboarding questionnaire (industry, company size, participant type).
- SAML/SSO.
- Broad RLS policy redesign. Only the minimum additional table-level policy required for self-profile update on `public.users` is permitted, if such a policy does not already exist. No existing Stage 1–5 RLS policies may be altered.
- Browser-based E2E verification (acceptance is document/code analysis only unless user requests otherwise).

## 5. STAGE 6 DATA CHANGES

### Migration: `public.users` Column Extensions
```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'seller';
```

### RLS Addition
- Existing `SELECT` policy on `public.users` remains unchanged.
- A new table-level `UPDATE` policy is required so that authenticated users may update only their own profile row. RLS policies govern row-level operations, not individual columns.
```sql
CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

### No New Tables
No new tables are introduced. The existing `organizations`, `users`, `deal_roles`, `deal_members`, `deals`, `pipeline_stages` tables are used as-is.

## 6. FILES EXPECTED TO BE CREATED OR TOUCHED

### New Files
- `src/app/(auth)/register/page.tsx` — Registration page with onboarding form.
- `src/app/(protected)/profile/page.tsx` — "Мой профиль" page.
- `supabase/migrations/2026MMDD_stage_6_registration_profile.sql` — Schema migration.

### Modified Files
- `src/app/(auth)/login/page.tsx` — Add "Зарегистрироваться" link to `/register`.
- `src/app/(protected)/layout.tsx` — Add "Мой профиль" nav link.
- `src/utils/supabase/middleware.ts` — Allow `/register` as a public route.

## 7. REGISTRATION FLOW SPECIFICATION

### User Journey
1. User visits `/login` → clicks "Зарегистрироваться" → navigates to `/register`.
2. User fills: email, password, first name, last name, organization name, (optional) job title, (optional) phone.
3. User clicks "Создать аккаунт" (Create Account).
4. **Two-phase server-side execution:**
   - **Phase 1 — Auth account + session (request context):** `supabase.auth.signUp({ email, password })` creates the auth user and establishes the browser session (email auto-confirm required as per operational prerequisite).
   - **Phase 2 — Workspace provisioning (trusted server-side, service-role or SECURITY DEFINER):**
     - Insert into `public.organizations` — creates seller's organization.
     - Insert into `public.users` — creates profile with `user_type = 'seller'`.
     - Insert into `public.deals` — creates a default deal for the new organization.
     - Insert into `public.pipeline_stages` — creates the 8 canonical deal-scoped stages for the newly created deal only (following the existing schema where `pipeline_stages.deal_id` references `deals.id`).
     - **Reuse existing `deal_roles` row** if the canonical `lead_advisor` role already exists; insert only if structurally absent. Do NOT blindly insert duplicate role rows on every registration.
     - Insert into `public.deal_members` — links user to deal with the resolved `lead_advisor` role.
   - Service-role credentials must remain server-side only; never exposed to the client.
5. **On partial failure:** If auth user was created (Phase 1) but downstream provisioning (Phase 2) fails, the orchestration must clean up or handle the incomplete state explicitly (see Section 3, partial-failure handling requirement).
6. On success: redirect to `/dashboard` (immediate access; no email confirmation gate).
7. On error: display Russian error message on the registration form.

### Validation Rules
- Email: required, valid email format.
- Password: required, minimum 8 characters.
- First name: required.
- Last name: required.
- Organization name: required.
- Job title: optional.
- Phone: optional.

## 8. PROFILE PAGE SPECIFICATION

### Layout
- Clean form layout consistent with existing app aesthetic.
- Two sections: "Личные данные" (Personal Data) and "Безопасность" (Security).

### "Личные данные" Section
- **Имя** (First name) — text input, editable.
- **Фамилия** (Last name) — text input, editable.
- **Электронная почта** (Email) — text, display only (grayed out).
- **Телефон** (Phone) — text input, editable.
- **Должность** (Job title) — text input, editable.
- **Компания** (Organization) — text, display only.
- **Тип участника** (User type) — text badge, display only ("Продавец").
- **"Сохранить изменения"** button.

### "Безопасность" Section
- **Новый пароль** — password input.
- **Подтвердите пароль** — password input (must match).
- **"Сменить пароль"** button.
- Uses `supabase.auth.updateUser({ password })`.

### Explicit Profile Scope Boundaries
"Мой профиль" is limited to:
- Viewing and editing personal data (name, phone, job title).
- Viewing identity/company/role info (email, organization, user type).
- Changing password.

"Мой профиль" explicitly does NOT include:
- Changing deal access or membership.
- Changing role assignments.
- Switching organization.
- Viewing or modifying deal-level permissions.

## 9. ACCEPTANCE CRITERIA
Stage 6 is successful only if all the following are true:
1. A new user can self-register **as a seller only** from `/register` with required fields. No participant-type picker exists.
2. Registration creates auth user + organization + user profile + default deal + deal-scoped pipeline stages + deal membership, all via trusted server-side orchestration.
3. Registration handles partial failure: no orphaned auth accounts with missing workspace data.
4. `deal_roles` `lead_advisor` is reused if present, not duplicated per registration.
5. `pipeline_stages` are created for the specific new deal only, following the existing deal-scoped schema.
6. Email confirmation is disabled / auto-confirmed in the Supabase project settings (verified as an operational prerequisite before execution); user has immediate dashboard access after registration.
7. The `/profile` page displays current user data and allows editing of name, phone, job title.
8. Password change works via the profile page.
9. The profile page does not expose any access control, role assignment, or membership modification.
10. The `/register` route is publicly accessible (no auth required).
11. All new UI surfaces are exclusively in Russian.
12. No buyer portal, invite flow, or multi-user features are introduced.
13. Stages 1–5 remain intact and functional.
14. The new migration adds `phone`, `job_title`, `user_type` columns without breaking existing data.
15. Only the minimum `UPDATE` table-level RLS policy on `public.users` is added. No existing policies are altered.

## 10. STAGE RISKS
- **Registration Abuse:** Without rate limiting or CAPTCHA, the registration endpoint could be abused. *Mitigation:* Supabase Auth has built-in rate limiting; additional CAPTCHA deferred to hardening phase.
- **Scope Creep (Invite Flow):** Temptation to build invite-based registration alongside seller registration. *Mitigation:* Strictly forbidden in this stage; invite flow is deferred.
- **Scope Creep (Participant Types):** Temptation to add a role/type selector on the registration form. *Mitigation:* Explicitly forbidden; `user_type` is hardcoded to `'seller'`.
- **Schema Drift:** Adding columns without proper migration discipline. *Mitigation:* Single migration file, idempotent `ADD COLUMN IF NOT EXISTS`.
- **Partial Registration Failure:** Auth user created but downstream workspace creation fails, leaving orphaned accounts. *Mitigation:* Trusted orchestration with atomic transaction or compensating cleanup (see Section 3).
- **`deal_roles` Duplication:** Blindly inserting `lead_advisor` on every registration. *Mitigation:* Document requires reuse-if-present logic.
- **Default Deal Logic:** Auto-creating a deal on registration adds complexity. *Mitigation:* Keep it minimal — one deal, 8 fixed deal-scoped stages, one role, one membership row.
- **RLS Policy Interaction:** New `UPDATE` policy is additive per operation type and does not conflict with existing `SELECT` policy.

## 11. HANDOFF TO NEXT STAGE
Upon acceptance of Stage 6, the project may proceed to:
**Stage 7 Planning: Invite Flow + Multi-Participant Access** — enabling deal owners to invite advisors and other participants via invite codes or magic links.
