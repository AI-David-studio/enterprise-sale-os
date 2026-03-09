# Stage 2 Implementation Task: Core Data Model + CRM / Pipeline Baseline

## 1. STAGE OBJECTIVE
The objective of Stage 2 is to deliver the core business data foundation and the fundamental CRM/Pipeline loop. This stage introduces the first real business entities into the system of record. It proves that the seller can create a deal, manage a list of prospective buyers, and track those buyers across defined pipeline stages. 

The implementation remains strictly **single-deal** and **seller-first**. This means no multi-deal UI, no deal switching, and no broad portfolio behavior. It builds safely atop the Stage 1 authentication and foundation baseline without prematurely introducing advanced operational modules like document vaults, tasks, or AI.

## 2. IN-SCOPE FOR STAGE 2
- **Core Business Data Foundation:** Schema migrations and RLS policies for Deals, Buyers, Pipeline Stages, and Buyer Pipeline States.
- **Core CRM / Pipeline Functionality:** 
  - Ability for the seller (superadmin) to create and edit a single Deal context.
  - Ability to create, edit, and view counterparty Buyers.
  - Ability to view and manage buyer progression through standardized pipeline stages (Preparation -> Teaser -> NDA -> CIM -> Meetings -> LOI/IOI -> Internal DD Tracking -> Closing) via a Kanban or List view. (Note: The presence of later stages like 'Internal DD Tracking' establishes the structural column model only; it does not authorize building DD functionality in Stage 2).
- **Minimal Stage 2 UI Surfaces:**
  - Deal page / workspace configuration interface.
  - Buyers directory (List view).
  - Buyer detail/profile page.
  - Pipeline board (Kanban or structured list).
- **Russian-First Enforcement:** All visible text in the CRM flow must be in Russian from the first commit.

## 3. OUT-OF-SCOPE FOR STAGE 2 (FORBIDDEN)
Execution of this stage must **strictly avoid** implementing:
- Document Repository / Vault (folders, file uploads, signed URLs).
- Communications Log (timeline entries, email sync).
- Task Manager / Checklist logic.
- AI jobs, Vertex AI integration, or `ai_outputs`.
- Due diligence (DD) request tracking.
- Offer/IOI/LOI negotiation logic or comparison engines.
- Dashboard business metrics beyond simple counts needed to prove the views work.
- Buyer-facing portals or external sharing matrices.
- Multi-user internal collaboration UI.
- Stage 3 or later operational workstreams.

## 4. STAGE 2 DATA ENTITIES
The following entities are strictly permitted to be scaffolded as the system of record in Supabase:

1. **`deals`**
   - *Purpose:* Represents the single core M&A transaction being managed.
   - *Stage 2 Justification:* Essential top-level parent entity for all CRM operations.
   - *Deferred:* Multi-deal workspace switching is explicitly deferred.

2. **`buyers`**
   - *Purpose:* Directory of target acquirers/counterparties.
   - *Stage 2 Justification:* Core subject of the CRM tracking loop.
   - *Deferred:* Buyer scoring, automated diligence gating, and buyer user logins are deferred.

3. **`pipeline_stages`**
   - *Purpose:* The canonical definitions of deal phases (Preparation -> Teaser -> NDA -> CIM -> Meetings -> LOI/IOI -> Internal DD Tracking -> Closing).
   - *Stage 2 Justification:* Required column headers/states for the pipeline board.
   - *Deferred:* Hard systemic stage blocking (milestones) and subsequent module logic (like DD tracking inner workings) are deferred.

4. **`buyer_pipeline_states`**
   - *Purpose:* Junction tracking where a specific buyer currently sits in the `pipeline_stages`.
   - *Stage 2 Justification:* Defines the core state machine for the kanban board.
   - *Deferred:* Complex automated event triggers off state changes, including `activity_logs` generation, are deferred to Stage 3.

## 5. SUPABASE ROLE IN STAGE 2
- **System of Record:** UI state must purely reflect the canonical data in Supabase.
- **Data Isolation:** RLS must be strictly enforced on the new business tables. A user must only see deals and buyers tied to their authenticated `organization_id` / `deal_members` association (as established in Stage 1).
- **Simplicity:** Favor straightforward synchronous CRUD operations from Next.js Server Actions. Do not introduce Kafka, distributed event buses, or heavy webhook architectures for simple state transitions in V1.

## 6. MINIMAL UI SURFACES FOR THIS STAGE
*All user-facing elements must be Russian.*

1. **Deal Page (`/deal`):**
   - «Сделка» (Deal details / metadata configuration).
   - *Includes:* Basic form to update deal name, description, target industry.
   - *Excludes:* Advanced access control matrices.
2. **Buyers List (`/buyers`):**
   - «Покупатели» (Directory of counterparties).
   - *Includes:* Table/List of buyers with "Add Buyer" («Добавить покупателя») capability.
   - *Excludes:* Complex filtering/scoring views.
3. **Buyer Detail Page (`/buyers/[id]`):**
   - «Карточка покупателя» (Deep-dive on a specific buyer).
   - *Includes:* Buyer metadata and current pipeline stage.
   - *Excludes:* Embedded communications log or document views (deferred to Stage 3).
4. **Pipeline View (`/pipeline`):**
   - «Воронка сделки» (Kanban board or state list).
   - *Includes:* Visual representation of buyers across stages, allowing stage transitions.
   - *Excludes:* Automated email triggers on drag-and-drop.

## 7. STAGE 2 FUNCTIONAL EXPECTATIONS
- The seller can successfully instantiate the core `deal` record.
- The seller can add new counterparties (`buyers`).
- The seller can move a buyer from "Preparation" to "Teaser" to "NDA" visually on the `/pipeline` board.
- State transitions are persisted correctly in Supabase.
- The entire process is navigable via the Stage 1 protected shell navigation.
- The application does not crash if fields are empty (safe null handling).

## 8. STAGE ACCEPTANCE CRITERIA
Before Stage 2 is considered complete and Stage 3 can begin:
1. **Entities Exist:** Migrations for Deals, Buyers, Stages, and Pipeline States are executed and RLS is enforced.
2. **CRM Loop Operates:** A user can create a buyer and advance their pipeline stage.
3. **Russian UI Maintained:** All new labels, buttons, and empty states introduced in Stage 2 are Russian.
4. **Scope boundary respected:** No document upload UI, no task lists, and no AI integrations leak into the build.
5. **Foundation intact:** Stage 1 Auth guarantees remain operative and secure.
6. **Controlled Git State:** Code remains reviewable on the Stage 2 execution branch before merge.

## 9. STAGE RISKS
- **Scope Expansion:** Attempting to build out the "Communications Log" widget inside the Buyer Detail page prematurely.
- **Schema Overbuild:** Creating tables for `due_diligence_requests` or `offers` during the standard CRM schema migration.
- **Permissions Drift:** Neglecting to apply strictly bound RLS policies to the new `buyers` table, exposing sensitive counterparty data across tenant partitions.
- **UI Complexity Creep:** Trying to build a highly interactive, generalized drag-and-drop board engine rather than a simple, hardcoded M&A state sequence.
- **Pipeline Logic:** Introducing strict validation blockers that prevent a user from moving a buyer if certain fields are empty, which violates the MVP mandate for high-velocity human operation.

## 10. HANDOFF TO NEXT STAGE
Upon acceptance of Stage 2 through a dedicated audit, the project will move sequentially to:
**Stage 3 Planning: Vault, Operations & Communications Baseline (Documents, Comm Logs, Tasks).** (Execution of Stage 3 strictly requires its own approved planning phase first).
