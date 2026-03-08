# System Architecture Baseline (L6)

## Architecture Goals
- Formulate a highly secure, data-driven system of record tailored to M&A constraints.
- Ensure Day 1 architecture seamlessly drives Phase 1 (single-seller) demands while organically resolving multi-user and multi-role scale organically without major rewrites later.
- Embrace a serverless-first orchestration pattern reducing administrative DevOps overhead.

## Architecture Principles
1. **System of Record (Supabase):** The relational database acts as the strict source of truth. UI state is derivative.
2. **Access via RLS:** Row-Level Security handles data isolation dynamically at query execution; the UI is strictly a view layer, not a security boundary.
3. **Anti-Overengineering constraints (MVP):** Use straightforward synchronous CRUD for core system-of-record operations. Avoid overengineered distributed event architectures, complex orchestration, or broad automation chains unless strictly required.
4. **Targeted Asynchrony:** Asynchronous processing (via edge functions or webhooks) is reserved primarily for AI jobs and heavy background tasks.
5. **Human-in-the-Loop AI:** AI jobs are explicitly asynchronous background tasks yielding output drafts. The architecture mandates human affirmative actions to promote drafts to canonical truths.
6. **Zero-Trust Private Storage:** Complete reliance on signed, expirable object URLs governed by user+deal scope intersections mapping to DB references. External buyer-facing granular document sharing engines are deferred to future phases; MVP document scope is restricted strictly to internal visibility and context-linking.

## System Context
The core system engages user operators via a Next.js web console interface, leveraging Supabase for Postgres SQL boundaries, Authentication, and Binary Storage, while securely delegating generative operations to Google Vertex AI.

## Major Components
- **Frontend App:** Next.js App Router (React, TypeScript, Tailwind CSS)
- **Backend / Database Layer:** Supabase SaaS PostgREST endpoint
- **Storage Subsystem:** Supabase Storage APIs
- **AI Orchestrator Execution:** Supabase Edge Functions processing asynchronously triggered webhooks invoking Vertex AI SDKs.

## Authentication and Authorization Model
- **Auth Layer:** Supabase Auth mapping JWT claims to session payloads.
- **Authorization Engine:** Role-Based Access Control materialized in SQL via `deal_roles` and `deal_members`. Policies invoke `auth.uid()` against these lookup tables to assert read/write rights contextually bounded by the specific `deal_id` associated with any child row.

## Canonical Data Domains (High Summary)
1. **Identity Schema (Multi-Tenant foundation):** Organizations, Users, Deal Member maps.
2. **Workflow Schema:** Deals, Pipeline Stages, Buyers, Tasks.
3. **Asset Schema:** Documents, Revisions.
4. **Intelligence Schema:** AI Jobs, Output Queue.
5. **Audit Ledger:** Immutable Activity Log.

## Event / Workflow Model
We intentionally avoid over-engineering enterprise BPMN workflows in Phase 1. 
Instead, core transitions are event-driven:
- Ex: A `buyer` traversing from NDA->CIM stage updates their `pipeline_status_id`. A Postgres trigger intercepts this, firing a timestamped record to the immutable `activity_logs`. 

## AI Orchestration Model
A rigid pattern for background AI safely distanced from execution flow lengths:
1. **Trigger:** User dispatches a command mapped to `ai_jobs` table (Status = Pending).
2. **Execution:** Database insert hooks (webhook) execute a remote Edge Function.
3. **Computation:** Function calls Vertex AI passing required textual context.
4. **Resolution:** Function writes resulting payload to `ai_outputs` table, resolving job Status to Completed.
5. **Review:** Client polls/listens to real-time events, presents the draft, awaiting explicit user save/discard commands.

## Integration Boundaries
In Phase 1, integrations are minimized to foundational PaaS cloud services. No aggressive CRM syncing or Email account oauth integrations; interactions rely on simple file imports or manual entry to keep MVP focus exceptionally tight on core rails.

## Audit / Logging Model
Immutability provides the backbone of trust required for an M&A system. Critical operations—updating role scopes, generating signed file links, moving a buyer's stage, changing deal states—must invoke database triggers pushing factual, append-only logs targeting `activity_logs`.

## Security Baseline
- **Data Segregation:** The `organization_id` AND `deal_id` indices must exist on functional rows, maintaining strict boundaries even inside MVP.
- **Signed URL enforcement:** No direct asset access.

## Core Data Flow Examples

**Buyer Created & Enters Pipeline:**
1. Seller creates a `buyer` record in UI submitting the form via Server Action.
2. Supabase endpoint handles HTTP POST -> Row created.
3. DB trigger logs "Buyer added" in `activity_logs`. Real-time UI listeners naturally update the Kanban component.

**Document Summarised (The AI Loop):**
1. Seller uploads "CIM.pdf"; Next.js pushes via API to Supabase Storage generating `documents` metadata pointing to the private path.
2. Seller requests a generative summary; UI posts a row to `ai_jobs` specifying {"type": "summarize", actionContext: docId}.
3. Webhook calls an edge function containing Vertex AI execution code retrieving text.
4. Edge function commits payload back to `ai_outputs`.
5. Seller reviews the pending draft payload on UI and clicks 'Promote'. UI rewrites the data into `documents.summary_text` as canonical.
