# MVP Implementation Plan (Phase 1)

## 1. IMPLEMENTATION OBJECTIVE
Deliver a **single-deal, seller-first M&A operating system** that replaces fragmented spreadsheets and cloud folders. This Phase 1 MVP focuses entirely on providing internal command, control, and visibility for the seller. **No buyer-facing portals or interactive external Q&A engines are included in this phase.**

## 2. RUSSIAN-FIRST UI REQUIREMENT (HARD RULE)
- **Primary Product Language:** All user-facing product surfaces in Phase 1 MVP must be in Russian from the absolute start. MVP must NOT be planned as English-first with localization later.
- **Scope of Russian UI:** This includes navigation, page titles, labels, buttons, forms, statuses, validation messages, empty states, dashboard widgets, workflow stage names, document categories, review queue labels, system notices, and default AI outputs.
- **English Permitted Only In:** Source code, DB table names, internal identifiers, developer-facing technical naming, and infrastructure/service names.

## 3. MVP BUILD PRINCIPLES
- **Seller-First:** Optimize purely for the `superadmin` experience moving one deal forward.
- **Smallest Correct Scope:** Build only what is necessary to run one real live deal end-to-end. Do not build for scale you do not yet have.
- **System-of-Record First:** UI state is purely a reflection of Supabase canonical data.
- **Security Before Convenience:** RLS strictly enforced on every table. Private, signed URLs only for documents. No public buckets.
- **Human-in-the-Loop AI:** AI generates drafts asynchronously. Humans must explicitly approve before promotion.
- **No Premature Complexity:** Favor straightforward synchronous CRUD. Avoid distributed event buses or complex backend workflow orchestrators in V1.
- **Phased Review Gates:** Build module by module, explicitly verifying and accepting each stage before advancing. No automatic cascading builds.

## 4. MVP MODULES TO IMPLEMENT
*Note: These are explicitly the ONLY modules to be built in Phase 1. Technical module names remain English internally, but all UI labeling must be Russian.*

- **Auth / Access Foundation:** 
  - *Purpose:* Secure the application and isolate tenant data.
  - *Included:* Next.js Supabase Auth, basic `superadmin` role mapping.
  - *Excluded:* SAML/SSO, complex multi-user invite flows.
- **Deal Workspace / Dashboard:** 
  - *Purpose:* Deal overview and health metrics.
  - *Included:* Active buyers, recent activity log, pending tasks.
  - *Excluded:* Multi-deal switchers, advanced customizable charts.
- **Buyer CRM & Pipeline Tracker:** 
  - *Purpose:* Track counterparty status.
  - *Included:* Buyer CRUD, Kanban/List view using canonical stages (*Preparation -> Teaser -> NDA -> CIM -> Meetings -> LOI/IOI -> Internal DD Tracking -> Closing*).
  - *Excluded:* Automated stage-gate blockers (milestones).
- **Document Repository (Vault):** 
  - *Purpose:* Secure file storage.
  - *Included:* Folder structures, private uploads, signed URL retrieval.
  - *Excluded:* External buyer sharing matrix UI, automated systemic redlining.
- **Communications Log:** 
  - *Purpose:* Centralize interaction history.
  - *Included:* Manual timeline entries linked to buyers.
  - *Excluded:* Full Google Workspace / M365 OAuth synchronization.
- **Task Manager:** 
  - *Purpose:* Process checklist.
  - *Included:* CRUD tasks, self-assignment for superadmin.
  - *Excluded:* Complex multi-user delegation queues.
- **AI Draft / Review Queue:** 
  - *Purpose:* Human-verified copilot assistance.
  - *Included:* Asynchronous webhook processing into a discrete review UI.
  - *Excluded:* Autonomous AI emailing or state mutations.

## 5. IMPLEMENTATION WORKSTREAMS
**Workstream A: Project Foundation**
- *Objective:* Initialize stack and repositories.
- *Dependencies:* None.
- *Deliverables:* Next.js App Router, Tailwind config, Supabase project link.

**Workstream B: Database & Security Baseline**
- *Objective:* Instantiate canonical tables with strict RLS.
- *Dependencies:* Workstream A.
- *Deliverables:* Executed SQL schema migrations for core entities; RLS policies verified.

**Workstream C: Deal & Buyer CRM (The Core Loop)**
- *Objective:* Enable basic pipeline tracking.
- *Dependencies:* Workstream B.
- *Deliverables:* Deal details view, Buyer directory, Kanban Pipeline Board, state transition logic mapping to Activity Logs.

**Workstream D: Secure Vault & Communications**
- *Objective:* Wrap M&A operational context around the CRM.
- *Dependencies:* Workstream C.
- *Deliverables:* Document upload/download flows with signed URLs, manual communication timeline.

**Workstream E: Task & Dashboard Aggregation**
- *Objective:* Provide the "Control Center" visibility.
- *Dependencies:* Workstreams C & D.
- *Deliverables:* Task checklist UI, live dashboard computing metrics from system-of-record tables.

**Workstream F: AI Copilot Flow**
- *Objective:* Integrate Vertex AI without blocking the main event loop.
- *Dependencies:* Workstream D.
- *Deliverables:* Edge function wiring, `ai_jobs` dispatching, Review Queue UI.

## 6. EXACT BUILD ORDER
*Note: The sequence is strict, but execution requires manual review and acceptance at the end of each logical phase before the next workstream begins.*
1. Supabase Project Initialization & Env Config
2. Schema Migration 1: Identity (`organizations`, `users`, `deal_roles`, `deal_members`)
3. Schema Migration 2: CRM (`deals`, `buyers`, `pipeline_stages`, `buyer_pipeline_states`)
4. Schema Migration 3: Operations (`documents`, `communications`, `tasks`, `activity_logs`)
5. Schema Migration 4: Intelligence (`ai_jobs`, `ai_outputs`)
6. Next.js Auth implementation & Route Protection
7. Deal Context Provider & Layout Shell
8. Dashboard Screen (Empty States)
9. Buyers List & Detail Screen (CRUD)
10. Pipeline Kanban Board Screen
11. Document Repository (Upload & Signed URL fetching)
12. Communications Log Timeline Component
13. Task Manager Component
14. Dashboard Metric Wiring
15. Supabase Edge Function: AI Orchestrator
16. AI Drafts / Review Queue Screen

## 7. MVP DATABASE ENTITIES REQUIRED
**Required Now (System of Record):**
- `organizations`
- `users`
- `deal_roles`
- `deal_members`
- `deals`
- `buyers`
- `pipeline_stages`
- `buyer_pipeline_states`
- `documents`
- `communications`
- `tasks`
- `activity_logs`
- `ai_jobs`
- `ai_outputs`

**Deferred Later (Do not implement in Phase 1):**
- `due_diligence_requests`
- `due_diligence_responses`
- `offers`
- `negotiation_rounds`
- `milestones`
- `approvals`
- `buyer_scores` (unless implemented purely dynamically)
- `document_shares` / buyer-specific permission mapping matrices

## 8. MVP PAGES / SCREENS REQUIRED
*Note: Technical routes are listed with their mandated Russian UI titles.*
- `/dashboard` — «Панель управления» (High-level health metrics, active buyer count, recent logs, pending tasks).
- `/deal` — «Сделка» (Edit deal parameters and metadata).
- `/buyers` — «Покупатели» (List directory of counterparties).
- `/buyers/[id]` — «Карточка покупателя» (Deep-dive on a specific buyer, embedding their communication timeline).
- `/pipeline` — «Воронка сделки» (Kanban board visualizing `buyer_pipeline_states`).
- `/documents` — «Документы» (File vault grouped by internal folders).
- `/tasks` — «Задачи» (The operational checklist).
- `/ai-review` — «Черновики ИИ» (Dedicated queue for pending AI outputs. Action buttons must be in Russian, e.g., "Одобрить", "Удалить").
- `/settings` — «Настройки» (Minimal user/organization profile variables).

## 9. AI ACTIONS REQUIRED FOR MVP
*Note: All default AI outputs presented to the user must be generated in Russian. Outputs remain draft-only until human approval.*

1. **Document Summarization**
   - *Trigger:* User selects a document in Vault.
   - *Input Context:* Extracted document text.
   - *Output Destination:* Output first lands in `ai_outputs` -> Presented in Russian in the Review UI.
   - *Review:* Seller must explicitly approve the draft before it is promoted into the relevant canonical record or attached metadata field.
   - *Why:* Instant value for long legal files.
2. **Email Drafting**
   - *Trigger:* User clicks "Draft Update" on a Buyer detail page.
   - *Input Context:* Buyer deal stage, recent `communications` log, deal/company context.
   - *Output Destination:* Output first lands in `ai_outputs` -> Presented in Russian in the Review UI.
   - *Review:* Seller copies text out or discards. System never sends email.
   - *Why:* Removes administrative friction of repetitive status updates.

## 10. IMPLEMENTATION PHASES / SPRINT LOGIC
- **Phase 1A: Foundation & Auth** (Data structure, Supabase RLS, Next.js routing).
  - *Exit:* User logs in and sees an empty protected dashboard tied to their `deal_id`.
- **Phase 1B: Core CRM** (Buyers, Stages, Pipeline Board).
  - *Exit:* User can create a buyer and drag them across the Kanban board.
- **Phase 1C: Operations** (Documents, Comm Logs, Tasks).
  - *Exit:* User can upload a CIM privately and log a phone call against a buyer.
- **Phase 1D: Intelligence** (AI Edge functions, Review Queue).
  - *Exit:* User can request a summary, wait, and approve the background result.
- **Phase 1E: Hardening** (Dashboard wiring, Audit Log verification).
  - *Exit:* Dashboard reflects accurate counts; `activity_logs` table proves immutability.

## 11. ACCEPTANCE CHECKPOINTS (Stop & Verify)
Before merging any phase, ensure:
1. **Security:** Cannot access data belonging to another `organization_id` (RLS test); Cannot view documents without a valid short-lived signed URL.
2. **Audit:** Pipeline transitions write a chronological event to `activity_logs`.
3. **AI Protocol:** AI generates asynchronously, defaults to Russian, and demands human action in the review queue.
4. **UI Language:** Russian UI labels are present on core screens. The seller can operate the core flow without English UI dependencies.
5. **Scope:** System remains strictly within the single-deal seller-first boundaries.

## 12. EXPLICITLY DEFERRED ITEMS (Out of Scope for Implementation)
- Buyer portal logins.
- External threaded Q&A engine.
- Multi-deal workspaces.
- Document sharing UI matrix for external clients.
- Direct Gmail/Outlook integrations.
- Formal Offer comparison engines (IOI/LOI).
- Hard systemic milestone blocking (e.g., "Cannot move to CIM until NDA signed" - kept human-enforced in MVP to maintain velocity).

## 13. RISKS DURING IMPLEMENTATION
- **RLS Mistakes:** *Mitigation:* Write stringent base policies immediately. Fail closed. Test with dummy tenant data continuously.
- **Schema Overbuild:** *Mitigation:* Strictly adhere to the Chapter 6 "Required Now" entities list. Reject deferred tables.
- **AI Over-Scope:** *Mitigation:* Hardcode the "Draft/Review" UI block. Never connect the Vertex AI response directly to a canonical system-of-record field without UX friction.
- **Event Overengineering:** *Mitigation:* Stick to simple Postgres triggers for audit logs or synchronous Next.js Server Actions. Do not introduce Kafka or heavy message queues.

## 14. FINAL READINESS STATEMENT
This Implementation Plan strictly enforces the Phase 1 MVP boundaries approved in the documentation. 

**Status:** The plan is ready for execution.
**First Actual Implementation Stage:** Workstream A (Supabase Project Initialization & Env Config) followed closely by Schematic Migrations.
