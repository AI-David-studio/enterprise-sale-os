# Stage 1 Implementation Task: Foundation + Auth Baseline

## 1. STAGE OBJECTIVE
The objective of this stage is to establish a secure, implementation-ready foundation for the Enterprise Sale OS. This stage strictly delivers the minimal Next.js application shell, configures the Supabase backend connection, and implements the foundational authentication flow. 

**This stage does NOT deliver business features.** Its sole purpose is to prove the project architecture is stable, secure (fail-closed routing), and ready for subsequent iterative module builds.

## 2. IN-SCOPE FOR STAGE 1
- **Project Foundation:** 
  - Next.js (App Router) initialization.
  - TypeScript & Tailwind CSS configuration.
  - Environment variable strategy setup.
  - Supabase client instantiation.
- **Auth Baseline:** 
  - Supabase Auth integration.
  - Route protection middleware (fail-closed logic).
  - Session handling and verification.
- **Data Foundation (Minimal):** 
  - Only the schema migrations definitively required to support login and identity (e.g., `organizations`, `users`, `deal_roles`, `deal_members`).
- **UI & Layout Shell:** 
  - Sign-in screen.
  - Empty protected dashboard shell (layout wrapper).
  - **Russian-First Enforcement:** All visible text in the auth flow and app shell must be in Russian.

## 3. OUT-OF-SCOPE FOR STAGE 1 (FORBIDDEN)
Execution of this stage must **strictly avoid** implementing:
- Buyer CRM or Pipeline logic.
- Document/Vault components or storage buckets.
- Communications logs or Task managers.
- Dashboard metrics (keep the shell empty).
- AI flows, edge functions, or `ai_jobs` generation.
- Full Phase 1 schema rollouts (only roll out Identity/Auth schema).
- External integrations or OAuth syncing.
- Buyer-facing UI, advanced settings scopes, or multi-user workflow UI.

## 4. FILES / AREAS EXPECTED TO BE CREATED OR TOUCHED
*(Note: Do not execute build. This list is for execution planning.)*
- `app/layout.tsx` (Root layout)
- `app/(auth)/*` (Login/Auth routes)
- `app/(protected)/layout.tsx` (Authenticated shell wrapper)
- `app/(protected)/dashboard/page.tsx` (Empty placeholder route)
- `middleware.ts` (Route protection)
- `utils/supabase/*` (Client and Server Supabase utilities)
- `supabase/migrations/*` (Only the initial Identity schema migration)
- `tailwind.config.ts` / CSS baseline

## 5. FOUNDATION DECISIONS
- **Framework:** Next.js App Router, React, TypeScript.
- **Styling:** Tailwind CSS (Clean B2B aesthetic).
- **Backend/Auth:** Supabase Auth mapping.
- **Security Posture:** Fail-closed by default. Any route not explicitly public must redirect to the sign-in screen if no active session exists.
- **Language:** Russian-first UI. All strings in the Auth UI (e.g., "Вход", "Email", "Пароль") and the shell layout (e.g., "Выйти", "Сделка") must be Russian.

## 6. AUTH BASELINE DECISIONS
- **Primary Persona:** The initial operational user is the Seller (`superadmin`).
- **Access Logic:** Protected access in Stage 1 simply enforces that a valid `superadmin` session exists. Complex UI matrices for different roles are not required.
- **Data Scope:** While the backend schema should map users to `deal_roles` and `deal_members`, the Stage 1 UI only requires successfully authenticating the user and rendering the protected shell.

## 7. MINIMAL UI SURFACES FOR THIS STAGE
*All user-facing elements must be Russian.*
1. **Sign-In Screen (`/login`):**
   - «Вход в систему» (Login)
   - «Электронная почта» (Email)
   - «Пароль» (Password)
   - «Войти» (Sign In)
2. **Protected App Shell (`/(protected)/*`):**
   - Clean left-rail or top-nav navigation placeholder.
   - Example nav items: «Панель управления», «Выйти» (Log Out).
3. **Empty Dashboard View (`/dashboard`):**
   - «Добро пожаловать» (Welcome placeholder text).

## 8. STAGE ACCEPTANCE CRITERIA
Before Stage 1 is considered complete and Stage 2 can begin, the following must be true:
1. **Bootstrapped:** The Next.js application runs locally without errors.
2. **Secure Routes:** Attempting to access `/dashboard` without authentication redirects to `/login`.
3. **Auth Flow:** An authorized credentials login successfully creates a session and redirects to `/dashboard`.
4. **Russian UI:** All visible UI text on the login screen and the empty protected shell is definitively Russian.
5. **No Scope Creep:** The codebase contains no premature implementation of business modules (CRM, Pipelines, Vault, AI).

## 9. STAGE RISKS
- **Premature Scope Expansion:** Building out CRM components before the auth envelope is perfectly secure.
- **Auth Complexity Creep:** Trying to build advanced SSO/SAML or multi-tenant invite flows when a simple email/password `superadmin` login suffices for V1 foundation.
- **English UI Leakage:** Using English placeholders for buttons or nav links, violating the Russian-first mandate.
- **Schema Overbuild:** Rolling out the entire database schema at once rather than just the needed `organizations / users` fragment.

## 10. HANDOFF TO NEXT STAGE
Upon acceptance of Stage 1, the project will move sequentially to:
**Stage 2: Core Data Model & CRM Pipeline (Deals, Buyers, Stages).**
