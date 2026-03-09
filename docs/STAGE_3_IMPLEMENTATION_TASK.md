# Stage 3 Implementation Task

## 1. STAGE NAME
**Stage 3: Vault + Operations + Communications Baseline**

## 2. STAGE OBJECTIVE
The objective of Stage 3 is to deliver the core operational layer for the seller, encompassing private Document storage (Vault), manual Communications logging, and basic Task management. This stage introduces the practical tools a seller needs to execute an M&A deal, but strictly remains an internal, seller-first tool. It explicitly does not introduce AI processing, buyer-facing portals, or automated integrations.

## 3. IN-SCOPE FOR STAGE 3
- **Documents / Vault Foundation:** 
  - Planning and schema for secure document metadata.
  - Private file uploads mapped structurally to the active `deal` only.
  - Minimal one-level category or tag grouping for documents.
  - Storage path discipline and signed URL retrieval.
  - Seller-first document usage only.
- **Communications Log:**
  - Manual creation of communication timeline entries.
  - Linking communication records to specific buyers and the deal context.
  - Simple chronological timeline/history view.
- **Tasks / Checklists:**
  - Simple seller-first task creation (CRUD) and completion toggling.
  - Basic status/state handling for operational checklists.
- **Supabase Storage Integration:**
  - Configuring a private bucket for vault files.
  - Enforcing strict RLS on the storage bucket and related database tables.
- **Russian-First UI:**
  - All new user-facing surfaces and labels must be generated in Russian.

## 4. OUT-OF-SCOPE FOR STAGE 3
- Vertex AI integration or `ai_jobs` / `ai_outputs`.
- Buyer-facing portal or external participant logins.
- Due diligence (DD) tracking, request, or response engine.
- Offer, IOI, LOI, or advanced negotiation logic.
- Automated email sending or direct Gmail/Outlook OAuth sync.
- Firebase deployment setup.
- Advanced analytics or broad dashboard business metrics.
- Document sharing UI matrix (mapping specific documents to specific external buyers).
- Multi-user collaboration UI or advanced task delegation/workflow engines.
- Multi-deal workspaces or deal switching.

## 5. STAGE 3 DATA ENTITIES
The following database entities are permitted strictly to serve the approved scope:

1. **`documents`**
   - *Purpose:* Stores metadata (name, category, Supabase Storage path, uploaded_by) for uploaded files.
   - *Stage 3 Justification:* Required for the Vault foundation and securing references to physical files.
   - *Deferred:* Granular `document_shares` or direct buyer linkages for external portal sharing are strictly deferred.
2. **`communications`**
   - *Purpose:* Logged, timestamped records of interactions (notes, calls, manual email summaries).
   - *Stage 3 Justification:* Required to build the chronological interaction history attached to a buyer.
   - *Deferred:* Live email sync (OAuth) and Vertex AI drafted replies are deferred.
3. **`tasks`**
   - *Purpose:* Internal checklist items with simple states (e.g., pending, completed).
   - *Stage 3 Justification:* Required to track operational next steps for the seller.
   - *Deferred:* Complex multi-tenant delegation, systemic milestone blocking, and approval sign-offs are deferred.

## 6. STORAGE MODEL / SUPABASE ROLE
- **System of Record:** Supabase Postgres remains the single source of truth for all structured entity data and file metadata.
- **Supabase Storage:** A dedicated private bucket (e.g., `vault`) will be introduced for physical file uploads.
- **Access Pattern:** Files must be completely private. Uploads and downloads will be facilitated exclusively via short-lived signed URLs generated securely by the backend.
- **No Public Access:** There shall be no public buckets or open URLs.
- **Sharing Limit:** There is no buyer-facing sharing matrix built in this stage. It is purely for the seller's internal organization.
- **Architecture Limit:** Implement straightforward synchronous uploads/downloads without overbuilt eventing or queueing.

## 7. MINIMAL UI SURFACES FOR THIS STAGE
All user-facing text must be Russian.
- **`/documents` (Документы):** 
  - *Purpose:* The main Vault interface.
  - *Actions:* Upload files, categorize files, list files, download files via signed URLs.
  - *Intentionally Excluded:* Multi-level folder navigation, "Share with Buyer X" buttons, or permissions matrices.
- **`/communications` (История коммуникаций):**
  - *Purpose:* The primary seller-facing feed to view and manually log interactions.
  - *Actions:* Add manual note/call details associated with a buyer, view chronological feed.
  - *Intentionally Excluded:* Threaded messaging engines, AI draft generation, email inbox sync, or real-time web sockets.
- **`/tasks` (Задачи):**
  - *Purpose:* The operational checklist.
  - *Actions:* Create task, mark as done, delete task.
  - *Intentionally Excluded:* Assigning tasks to external parties or complex dependency graphs.

## 8. STAGE 3 FUNCTIONAL EXPECTATIONS
- The seller can securely upload private files into the Supabase Storage bucket via the UI.
- The seller can retrieve uploaded files securely through signed access patterns.
- The seller can manually log communications and link them to respective buyers.
- The seller can create and check off tasks.
- All new functionality integrates seamlessly into the existing single-deal, seller-first protected routing shell.
- Navigation menus and headers are updated to reflect the new capabilities, strictly in Russian.

## 9. ACCEPTANCE CRITERIA
Stage 3 is successful only if all the following are true:
1. Stage 3 entities (`documents`, `communications`, `tasks`) exist, have strict RLS, and are fully usable.
2. Physical file storage is private, mapping correctly to `documents` metadata.
3. Signed URL access for secure file retrieval works correctly.
4. Communications are manually loggable against buyers.
5. Tasks are operable (create/complete).
6. All visible user-facing UI in Stage 3 surfaces is exclusively in Russian.
7. No AI, buyer portal, DD, or negotiation features have been implemented.
8. Stage 1 (Auth) and Stage 2 (CRM Pipeline) remain intact and functional.

## 10. STAGE RISKS
- **Storage Security Mistakes:** Misconfiguring Supabase Storage policies, accidentally exposing public file access, or failing to enforce signed URLs.
- **Scope Creep (Sharing):** Giving in to the temptation to build the buyer document-sharing permission matrix prematurely. Let all documents belong directly to the seller's view of the deal.
- **Scope Creep (Integrations):** Letting communications logging drift into actual email integrations or threaded real-time messaging.
- **Schema Overbuild:** Making task logic too advanced (e.g., dependencies, complex organizational assignments) or introducing unnecessary bridging tables.
- **UI Complexity:** Building complicated nested folder trees rather than a simple, functional flat list or categorical tag structure suitable for an MVP.

## 11. HANDOFF TO NEXT STAGE
Upon successful implementation and acceptance audit of Stage 3, the project will move sequentially to:
**Stage 4 Planning: Intelligence & AI Copilot Flow Baseline (Review Queue, Edge Functions).** 
*(Execution of Stage 4 strictly requires its own approved planning document first).*
