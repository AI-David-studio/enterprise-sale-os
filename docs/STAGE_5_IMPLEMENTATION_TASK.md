# Stage 5 Implementation Task

## 1. STAGE NAME
**Stage 5: Seller Dashboard & Operational Polish** (Implementation Execution Blueprint)

## 2. PURPOSE
The objective of Stage 5 is to complete the Phase 1 MVP by providing the seller with a unified "Control Center" for their active deal. Stages 1–4 successfully established the underlying data primitives (CRM, vault, tasks, communications) and the intelligence layer (AI drafts), but the seller currently lacks top-down visibility. Stage 5 aggregates this existing canonical data into a single, high-level dashboard to complete the core operational loop, ensuring the system functions as a true command center for the deal.

## 3. AUTHORITATIVE SCOPE
Stage 5 is strictly limited to the following:
- Implementation of the `/dashboard` route as the primary seller control surface within the protected shell.
- Display of top-level aggregated metrics for the single active deal, computable from the existing schema only.
- Display of a recent activity feed reading from existing safe data sources.
- Visibility into priority pending tasks.
- Visibility into pending AI review queue actions (if applicable).
- Operational polish for dashboard-level presentation and data aggregation.
- Strict adherence to the Russian-first UI requirement on all new surfaces (e.g., no English placeholder links like "See all").

This stage is definitively **read-only** and **aggregation-first**. Dashboard actions do not introduce new write workflows, mutate canonical records, or trigger new AI generation. It only surfaces summaries and navigation into already-existing modules.

## 4. EXACT IN-SCOPE ITEMS
The execution of Stage 5 must implement exactly:

- **`/dashboard` Page Behavior:**
  - Serves as the seller control surface within the protected layout. (If the current baseline auth already redirects here, retain it; otherwise, do not modify existing login redirect behavior).
  - Fetches the `deal_id` context for the current user's active deal.
- **Metric Cards / Summary Widgets (Russian UI):**
  - "Всего покупателей" (Total count of buyers currently linked to the active deal pipeline according to the existing tables—do not invent unsupported stage semantics).
  - "Ожидающие задачи" (Count of incomplete tasks).
  - "Черновики ИИ" (Count of `ai_outputs` pending review).
- **Recent Activity Feed:**
  - A chronological list of recent events. **Crucially:** use `activity_logs` *ONLY* if it already exists and is reliably populated in the current implementation baseline. If absent or unreliable, fallback to aggregating existing sources (e.g., recent `tasks`, recent `communications`, recent `ai_outputs`). Do NOT introduce new audit infrastructure in Stage 5.
- **Pending Tasks Summary:**
  - A quick-access list of the top 3-5 incomplete tasks ordered by priority or creation date.
- **Links & Navigation:**
  - Russian navigation links (e.g., «Смотреть все») from the dashboard widgets routing to the respective specialized views (e.g., `/buyers`, `/tasks`, `/ai-review`).

## 5. DATA SOURCES / READ MODEL
The dashboard implementation must query *only* from the following pre-existing MVP tables. Do not assume or require new relations:
- `deals` (to resolve active context)
- `buyers` / `buyer_pipeline_states` (for buyer count metrics)
- `tasks` (for pending task metrics and list)
- `communications` (optional fallback for activity feed)
- `ai_outputs` (for pending review metrics and optional fallback for activity feed)
- `activity_logs` (ONLY if already reliably populated by pre-existing triggers; do NOT write new audit triggers in this stage)

## 6. ROUTE / UI REQUIREMENTS
- **Route:** `src/app/(protected)/dashboard/page.tsx`
- **Purpose:** High-level deal health overview and operational prioritization.
- **Layout:** Summary-first / Control-center grid layout.
- **Language:** Russian-first mandatory (e.g., «Панель управления», «Последняя активность»).
- **Restrictions:** 
  - No buyer-facing elements.
  - No advanced charting libraries (e.g., Chart.js, Recharts). Use simple numeric widgets, text lists, and progress bars utilizing Tailwind CSS.

## 7. STRICT OUT-OF-SCOPE
The following are explicitly forbidden to prevent scope drift:
- Multi-deal selection or cross-deal aggregate reporting.
- Buyer portal or external data room behavior.
- Advanced BI, report builders, or exportable PDF generation.
- New autonomous AI reporting generation (e.g., "AI Deal Health Summary").
- Due diligence (DD) response engines.
- Negotiation engines (IOI/LOI comparison).
- Gmail/Outlook syncing or scraping.
- Firebase deployment configurations or CI/CD pipelines.
- OCR/parsing subsystem development.
- Schema expansion (no new tables may be introduced for the dashboard).

## 8. FILES EXPECTED TO CHANGE
Execution is expected to touch:
- `src/app/(protected)/dashboard/page.tsx` (primary implementation)
- `src/app/(protected)/layout.tsx` (minor adjustments to ensure default routing highlights the Dashboard, IF minimally required)
- `src/components/` (minimal presentational components may be added only if necessary; broad component refactors are explicitly NOT part of Stage 5)

## 9. ACCEPTANCE CRITERIA
Stage 5 is complete only if:
1. The `/dashboard` route loads successfully without errors.
2. The dashboard displays accurate, aggregated metrics derived exclusively from existing canonical Supabase tables.
3. The recent activity feed or task summary correctly visualizes real operational data without requiring new audit infrastructure.
4. The entire dashboard UI is constructed seamlessly in Russian, with no English placeholder labels.
5. No new database tables were introduced.
6. No RLS or auth flow redirect changes were required.
7. No Stage 1–4 boundaries were broadened (no new writes or AI logic).
8. No browser-based verification is required by default for Stage 5 acceptance.

## 10. REGRESSION / SAFETY CRITERIA
Execution of Stage 5 must strictly preserve:
- Stage 1: Auth/Foundation (RLS policies remain inviolate).
- Stage 2: CRM/Pipeline (Buyer data remains isolated).
- Stage 3: Documents/Communications/Tasks (Storage buckets and vault logic remain untouched).
- Stage 4: AI Copilot (The Vertex AI integration and review queue boundaries remain secure and unaltered).

## 11. STOP CONDITIONS FOR LATER EXECUTION
Execution must HALT and report to the user if:
- Required canonical data (at minimum `tasks`; and `activity_logs` only if already present and reliable) is structurally incompatible with safe aggregation.
- The dashboard requires heavy analytical SQL queries that dramatically impact performance, necessitating a schema redesign.
- Any task requires implementing charting libraries or complex external BI scripts.
- It becomes impossible to build the dashboard without modifying existing Stage 1–4 tables or RLS policies.
