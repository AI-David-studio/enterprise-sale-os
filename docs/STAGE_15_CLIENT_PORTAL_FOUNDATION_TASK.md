# STAGE 15 PLANNING: CLIENT PORTAL FOUNDATION

## 1. STRATEGIC POSITIONING & PURPOSE
Stage 15 explores crossing the trust boundary from a strictly internal, seller-facing CRM into an external-facing system where clients, investors, or buyers can access deal information directly. 

**The External Persona:**
- **WHO**: An external buyer-side evaluator or investor representative invited to review a single deal. (Note: LP or target-company executive personas are EXPLICITLY OUT OF SCOPE for this stage family unless separately planned much later).
- **WHY**: To review explicitly approved data room documents without relying exclusively on email.
- **WHAT**: Controlled, read-only access to a deal summary and explicitly approved external-facing documents; server-mediated download of external-facing documents only.
- **WHAT THEY MUST NOT DO**: See other buyers in the pipeline, see internal seller tasks, view internal communications, execute AI workflows, edit deal parameters, or view internal draft/working documents. Any workflow progression, NDA execution, offer handling, or messaging is explicitly OUT OF SCOPE.

## 2. TRUST BOUNDARY & SECURITY ANALYSIS 
Introducing external actors requires examining the current Stage 8 RLS baseline and the `roles.ts` model to ensure lateral traversal is prevented.

**Current State Analysis (`docs/STAGE_8_RLS_PERMISSION_ENFORCEMENT_TASK.md`, `roles.ts`):**
- **Available Roles**: `lead_advisor`, `advisor`, `viewer`.
- **The `viewer` Role Risk**: Current `viewer` is an INTERNAL read-only role, not an external portal role. 
  - `viewer` can `SELECT` from all `buyers`, `pipeline_stages`, and `buyer_pipeline_states`. This CRM visibility is categorically unsafe for external users.
  - `viewer` can `SELECT` from all `documents`. This internal document visibility is too broad for external principals unless an explicit external-document isolation model exists.
- **Conclusion**: We **cannot** simply assign the existing `viewer` role to external investors. External portal UI must not be built on top of current `deal_members + viewer`. Doing so would result in external buyers querying the API to see competing buyers and internal documents, compromising core M&A confidentiality.

**Required Architectural Shift**:
The recommended direction is a separate external-access isolation model, not reuse of current internal `deal_members` semantics.

## 3. MINIMAL PORTAL SCOPE OPTIONS

### Option A: Reuse `viewer` role (The "Fast" Portal)
- **Concept**: Build generic read-only pages and assign `viewer` role via the existing invite flow.
- **Security Risk**: Critical data leak. External users inspect network traffic/API to see all buyers and internal deal data.
- **Verdict**: **REJECTED.** Violates Stage 8 isolation and basic confidentiality.

### Option B: A Basic Buyer Portal (UI + Security Fix)
- **Concept**: Add a new `external_buyer` role. Modify Stage 8 RLS so `external_buyer` can only see documents explicitly marked `is_public` or tied to their specific buyer ID. Build the UI concurrently.
- **Implementation Complexity**: Too high for a single stage. Mixing fundamental RLS/Schema changes with new UI development violates the project's strict separation of concerns and increases the risk of regressions.
- **Verdict**: **REJECTED AS A SINGLE STAGE.**

### Option C: The Clean Separation (Client Portal Foundation NO-GO)
- **Concept**: Acknowledge that the current `deal_members` + `viewer` model represents an *internal* organizational boundary. Building an external portal requires a dedicated security definition phase (Stage 15a: External Security Context) *before* building the UI (Stage 15b: External Portal UI).
- **Security Risk**: Zero, because we prevent external access until the data layer is proven secure.
- **Verdict**: **RECOMMENDED OPTION.**

## 4. LOCKED STAGE 15 SCOPE & DECISION

### GO / NO-GO Decision
**NO-GO for Client Portal UI Execution.**

Stage 15 (Client Portal Execution) is premature. The current architecture successfully protects internal roles from each other (e.g., blocking `viewer` from AI or tasks), but it explicitly assumes all members in `deal_members` are internal to the selling organization or syndicate. 

Exposing the current API to external principals without first hardening the data layer against lateral buyer-to-buyer traversal is an unacceptable security risk.

### Required Next Step
The immediate next stage is not portal UI execution, but security-isolation planning for external principals. Before any external UI is built, the system needs a dedicated external-access isolation design that separates external principals from internal seller-side membership semantics.

We must plan a **Preparatory Stage** named:
*STAGE 15 PRECONDITION: EXTERNAL SECURITY ISOLATION PLANNING*

This stage will:
1. Introduce a new separate external-access isolation model.
2. Formally define how external access filters queries strictly to approved documents, explicitly preventing `SELECT` on CRM tables.
3. Define the safe query boundaries and invitation semantics required for external principals. Any future invite-flow code changes are downstream implementation work after the security model is locked.

**Only after the data layer is proven secure for external actors can we build the Client Portal UI in a subsequent stage.**

## 5. SAFE SURFACE CANDIDATE & FORBIDDEN EXPOSURE

**The only potentially safe future external-facing surface candidate is:**
- Explicitly approved external-facing deal summary
- Explicitly approved external-facing documents
- Server-mediated download only

**Forbidden Exposure (Categories that must never be exposed to the external persona):**
- Buyers list or competitor identities
- Pipeline states
- Internal communications
- Seller tasks
- AI outputs
- Internal working/draft documents

## 6. OUT-OF-SCOPE LOCK (For future Execution)
Even when the UI phase begins, the following are strictly forbidden:
- Open registration or public access (must remain invite-only).
- Buyer-side mutations (uploading files, moving pipeline stages).
- Meaningful portal messaging/chat interfaces.
- Offer submission workflows or negotiation UI.
- Access to AI review or AI generation logic.
- Exposure of internal tasks or communications histories.
- Admin panel, multi-deal buyer dashboard, or external role editors.
- Schema or execution changes during the immediate planning phase.

## 7. ACCESS MODEL DECISION
The current internal `deal_members` semantics must NOT be reused for external principals. The recommended direction is a separate external-access isolation model. The exact structural implementation remains to be defined in the next precondition planning stage.

When the preparatory security work is complete, the portal will reuse the existing Supabase Auth infrastructure and the high-level invite flow. However, external portal access will be tied to the new structural division in the database, separating them from internal deal semantics.

## 8. EXECUTION READINESS CHECK
**NO-GO.**

**Execution is blocked.** Current architecture cannot safely support external users.
**Next Recommended AG File**: "STAGE 15 PRECONDITION: EXTERNAL SECURITY ISOLATION PLANNING"
