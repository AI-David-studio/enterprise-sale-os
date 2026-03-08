# Phased Roadmap Strategy

## Phase 1: Personal Deal OS (Seller OS MVP)
**Goal:** Deliver a single-deal, seller-first operational system replacing fragmented emails and spreadsheets to stabilize one active transaction.
**Scope:** 
- Core Deal Workspace & Pipeline CRM
- Secure Document Repository (Internal Data Room)
- Activity & Communication Logging
- Asynchronous AI Copilot Setup
**Dependencies:** Robust baseline documentation and architecture approval spanning Auth, RLS, and Data Domains.
**Technical Milestones:**
- M1.0: Foundation (Next.js, Supabase config, canonical schemas)
- M1.1: Auth & Role-Based Access Control (RBAC) backbone
- M1.2: Pipeline & CRM tracking logic
- M1.3: Secure Storage integration
- M1.4: Asynchronous AI orchestrator scaffolding
**Release Condition:** Single Seller can run one real M&A deal end-to-end within the system.

## Phase 2: Operational Team & Advisor Collaboration
**Goal:** Transition from a single-player to a multi-player *internal* platform, enabling efficient internal delegation and workflows across finance, legal, and advisory resources.
**Scope:** 
- Multi-user task assignment and review queues
- Enhanced Due Diligence readiness tracking
- `@mentions` and internal messaging
- Refined Role-based views (different dashboard for Advisor vs Owner)
**Dependencies:** Phase 1 robust audit log validity and proven scalability of the RBAC model.
**Technical Milestones:** Notifications layer engine, dynamic UI view switching based on user role assignments.

## Phase 3: Buyer-Facing Expansion & Multi-Deal Maturity
**Goal:** Open platform perimeters to counterparties (buyers and third-party reviewers) via interactive portals, and evolve the core to handle multi-tenant, multi-deal advisory firms.
**Scope:** 
- External Buyer Portals (secure read-only data room access with Q&A submission)
- Multi-deal workspace switcher capabilities for advisory profiles
- Deal Readiness and Probability-to-Close AI analytics
**Dependencies:** Proven Phase 2 internal workflow maturity and absolute confidence in the Document Permission boundaries preventing data leakage.
**Technical Milestones:** Cross-deal RLS rule implementations, external identity management provisioning.
