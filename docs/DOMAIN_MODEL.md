# Canonical Domain Model

This document outlines the conceptual entities comprising the system. It cleanly distances mandatory Phase 1 entities representing the "System of Record" from future expanded entities reflecting the platform scale vision. This conceptual model will drive the future MVP baseline SQL schema.

## Domain Boundaries & Entity Ownership
Every entity that holds functional data **must fundamentally traverse up to belong to a specific `deal` and an `organization`**. This organizational/deal hierarchy defines the strict multi-tenant boundary parameters driving database RLS policy enforcement.

---

## Phase 1 Required Entities (System of Record)

These entities represent the mandatory foundational schema required to build the Seller OS MVP.

### Identity & Access (The Foundation)
- **`organizations`**: The tenant container. Defines a seller's company or the advisory firm framework.
- **`users`**: Platform identities tied to the underlying Auth platform mapping.
- **`deal_roles`**: Enum / config identifying permission parameters (e.g., `superadmin`, `advisor`, `buyer_restricted`).
- **`deal_members`**: The critical junction mapping `users` to `deals` assigning them specific `deal_roles`. Determines exactly which user gets what workspace.

### Deal & CRM Workflow
- **`deals`**: The primary transaction namespace container representing the active M&A event.
- **`buyers`**: Organizations or PE firms acting as the counterparty entities in the cycle.
- **`pipeline_stages`**: The configuration bounds of the workflow funnel (Preparation, Teaser, NDA, CIM, Meetings, LOI/IOI, Internal DD Tracking, Closing).
- **`buyer_pipeline_states`**: Junction representing specifically where a `buyer` currently sits within the deal pipeline.
- **`tasks`**: Action items logged for internal ops completion.

### Asset Management
- **`documents`**: Metadata mapping object names and definitions pointing explicitly to private Supabase Storage object identifiers.

### Audit & Intelligence
- **`communications`**: Logged, timestamped records of interactions linked to specific buyers.
- **`activity_logs`**: Immutable ledger of all critical operational events.
- **`ai_jobs`**: Job-tracking queue table to manage the lifecycle of asynchronous LLM requests to prevent thread blocking execution.
- **`ai_outputs`**: The staging table for generative data, explicitly enforcing a secondary read/approve human action before becoming canonical fact.

---

## Future Phase Entities (Architected but operationally deferred)
The MVP architecture must conceptually accommodate these components cleanly without disrupting core structure down the track. They are **not** needed in the Phase 1 MVP implementation plan.

- **`due_diligence_requests`** (Phase 2+): Formal Q&A request models linked to buyer submissions.
- **`due_diligence_responses`** (Phase 2+): Internal thread tracking the aggregation of legal answers to requests.
- **`offers`** (Phase 2+): Financial valuation schema for tracking structured intent records explicitly vs informally tracking them in communications.
- **`negotiation_rounds`** (Phase 2+): Groupings of offers by phase.
- **`milestones`** (Phase 2+): Hard systemic workflow blocks demanding designated `deal_members` formally sign off on stage criteria before progression can be actioned.
- **`approvals`** (Phase 2+): Formal sign-off records required for critical actions.
- **`buyer_scores`** (Analytical): Derived logic or lightweight AI outputs; persisted tables should be deferred unless strictly required for immediate MVP storage.
- **`document_shares` / `permissions`** (Phase 2+): The granular mapping enforcing external buyer access. MVP relies on simpler backend RLS foundation for the seller.

## Important Architectural Entity Rules

1. **System of Record vs. Derived Analytics:** 
If a buyer moves to a new stage, that is a direct mutation to the systemic state (`buyer_pipeline_states`). Showing "time in current stage" shouldn't necessarily be an entity cache; prefer deriving it accurately via chronological aggregations of the `activity_logs` representing state changes.

2. **Absolute Immutability within Audit Paths:** 
Operational records like `activity_logs` should never permit UPDATE or DELETE level API operations. 

3. **Mandatory AI Review Demarcation:** 
The strict separation of `ai_jobs` progressing to `ai_outputs` ensures background models can generate, hallucinate, or draft independently of polluting canonical schema data representations, enforcing the "Human Co-Pilot" execution directive.
