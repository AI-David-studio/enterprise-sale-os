# MVP Scope (Phase 1)

## Executive Summary
Phase 1 (MVP) focuses entirely on creating a **single-deal, seller-first operating system**. The goal is to provide immediate operational value for the seller to manage one live sell-side process without the chaos of fragmented spreadsheets and emails.

## Phase 1 Scope
- **Deal Workspace**: A centralized command center providing pipeline visibility and overall deal health.
- **Buyer CRM**: Structured tracking of interested parties and their current pipeline stage.
- **Pipeline Tracker**: Kanban/list tracking conforming to standard deal stages (Preparation -> Teaser -> NDA -> CIM -> Meetings -> LOI/IOI -> Internal DD Tracking -> Closing).
- **Document Repository**: Structured internal data room with strict, role-based private storage capability.
- **Communication Timeline**: Centralized log of key interactions and updates per buyer.
- **Task & Milestone System**: Sequential checklist tracking for internal execution.
- **Seller Dashboard**: Top-level analytics aggregating deal metrics.
- **AI Copilot Actions**: Narrow, practical AI assistance (e.g., summarize document, draft email) operating asynchronously.

## Explicit Phase 1 Exclusions (Out of Scope)
- **Buyer-Facing Portals**: Buyers do not log in to interact with the system in Phase 1. 
- **Due Diligence Portal**: Due diligence tracking is limited to internal readiness and tracking external requests, not serving them through an external interactive portal yet.
- **Multi-Deal/Portfolio Management**: The system runs one active deal for the seller at a time.
- **Deep Integrations**: Communications will be logged manually or via simple lightweight mechanisms; no complex OAuth syncing with external calendars/CRMs.
- **Complex Workflow Builders**: Workflows are standardized based on canonical M&A rails, not drag-and-drop.
- **Autonomous AI Actions**: AI cannot send emails, approve documents, or change deal state without explicit human review and confirmation.

## MVP Assumptions & Implementation Constraints
- **Communications Logging:** Logged entirely via manual entry or lightweight import/BCC patterns in MVP. Heavy OAuth syncs (e.g., direct Gmail/Outlook integrations) are explicitly deferred.
- **Document Permissions:** MVP relies on a strong backend RLS foundation ensuring overall data security, paired with simple superadmin-facing UI controls rather than complex granular folder/buyer sharing matrices.
- **Due Diligence:** In MVP, tracking due diligence is purely for internal readiness and tracking. There is no external buyer Q&A portal or structured request/response engine facing third parties.

## Operational Boundaries
- The primary user is the Seller (Superadmin).
- The system acts as an internal tool. External stakeholders (buyers, third-party reviewers) are tracked as entities, but are not active users navigating the platform in V1.
- The seller (superadmin) has the authority to dictate the process platform.
- Users have modern browsers and stable internet (no offline-first requirement for MVP).
- The initial deal structure follows a traditional sell-side auction or targeted process.
- All documents are stored securely using private URLs and stringent role-based checks at the database level.

## MVP Design Principles
- **Seller-Led**: Prioritize tools that save the seller time and provide clarity.
- **Execution-First**: Only build features required to push a transaction forward; avoid theoretical platform features.
- **Future-Ready Architecture**: Data structures and permission models must naturally accommodate role-based expansion (Phase 2) and multi-tenant capabilities (Phase 3) without requiring schema rewrites.

## Success Criteria for MVP (Phase 1)
1. A seller can log into the platform and view the exact status of a live deal on a unified dashboard.
2. The seller can track multiple buyers across a canonical M&A pipeline without using external spreadsheets.
3. Documents can be securely uploaded, categorized, and linked to specific buyers or pipeline stages.
4. AI functions successfully draft content and summarize data asynchronously, queueing outputs for human approval.
5. The system operates as the undisputed single source of truth for the active deal end-to-end.
