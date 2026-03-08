# Product Specification

## Product Purpose
To serve as the definitive, reusable web-based Sell-Side M&A Management Platform, enabling sellers to control the chaotic lifecycle of selling a company from preparation to closing. 

## Product Positioning
This is not a generic B2B Sales CRM, nor is it a standalone virtual data room (VDR). It is a specialized, end-to-end deal control center and operating system designed precisely for the complexities, security requirements, and rigorous workflows of an M&A transaction.

## Problem Statement
Company sales are executed via fragmented communication channels, disjointed spreadsheets, and disconnected data rooms. This fragmentation causes information loss, process delays, severe execution chaos for the seller, and an increased risk of deal fatigue or failure.

## Target Users
- **Seller (Superadmin):** The owner/founder driving the sale. This is the primary user and focus for Phase 1.
- *Future Roles*: Internal Team (Ops/Finance), Advisors (Investment Bankers), Reviewers (Auditors), Buyers.

## User Goals by Role
- **Seller:** Maintain absolute visibility and control over buyer intent, document security, and deal velocity. Minimize administrative overhead to focus on negotiation.

## Core Product Principles
1. **Seller-First, Future Multi-User:** Phase 1 optimizes solely for the seller, while establishing robust role-based access for future users in the data layer.
2. **Execution-First:** Practical utilities prioritizing real-world transaction progress over theoretical features.
3. **AI as Co-Pilot:** AI supports human operators (drafting, scoring, flagging) but is never an autonomous decision-maker. Must rely on human review loops.
4. **Structured Auditability:** All key actions produce immutable logs for compliance and traceability.
5. **Reusable Foundation:** System must efficiently adapt to 100% share sales, carve-outs, or minority deals without hardcoded elements for any single organization.

## Phase 1 Scope (MVP)
The MVP is a single-deal, internally focused command center for the Seller.
- Deal Workspace & Seller Dashboard
- Buyer CRM & Pipeline Tracker
- Secure Internal Document Repository
- Communication Event Logging
- Simple Task/Milestone Tracker
- Asynchronous AI Drafting & Summarization (Copilot)

## Out of Scope for Phase 1
- Interactive external Buyer Portals
- Deep integration with third-party email tools (manual logging preferred for MVP)
- Multi-company architecture exposed in the UI
- Advanced automated reporting/PDF generation for third parties

## Core Modules & Main Screens (MVP)
1. **Workspace / Dashboard:** Default landing view showing deal overview, critical alerts, recent activity, and high-level health metrics.
2. **CRM/Pipeline:** Kanban and list views of the buyer funnel (Preparation -> Teaser -> NDA -> CIM -> Meetings -> LOI/IOI -> Internal DD Tracking -> Closing).
3. **Buyers List & Detail:** Directory of all interested parties, with deep-dive views into specific contact info and interaction history.
4. **Documents (Vault):** File management screen with strict RLS permissions, folder structures, and upload capabilities.
5. **Communications Log:** Timeline view of logged emails, calls, and approvals contextualized by buyer.
6. **Task Manager:** Checklist view for tracking internal execution milestones.
7. **AI Drafts / Review Queue:** Dedicated space to review, edit, approve, or discard asynchronous AI outputs.
8. **Minimal Settings:** Basic configuration for the active deal and user profile.

## Core User Flows
1. **Initialize Deal:** Seller configures deal parameters, pipeline structure, and initial prep materials.
2. **Track Buyer:** Seller adds a buyer, logs a communication, and advances them to the "NDA" pipeline stage.
3. **Secure Repository:** Seller uploads the CIM; system executes OCR in the background; seller categorizes it for restricted phase access.
4. **AI Generation:** Seller requests a summary of an uploaded LOI; AI generates the summary in the background; Seller reviews, approves, and saves the output.

## Functional Requirements
- System must support CRUD operations for buyers and contacts.
- System must provide defined pipeline stages transitioning counter-parties through a deal lifecycle.
- System must allow uploading files via private storage, viewing them securely, and tracking revisions.
- AI jobs must run asynchronously, utilizing queues, and explicitly require human `approve` or `discard` actions.

## Non-Functional Requirements
- **Security:** Strict Row-Level Security (RLS) ensuring absolute data isolation based on deal and role. Zero public bucket exposure; signed URLs only.
- **Audit:** Immutable ledger of critical state changes (Stage transitions, Document views, Adds/Deletes).
- **Scale:** Modular backend capable of being extended incrementally.

## Roles and Permissions
Phase 1 implements a foundational but restricted mapping:
- `superadmin`: Full control (The Seller).
*Note: The canonical database structures natively accommodate `advisor`, `team`, and `buyer` roles, setting the stage for Phase 2 without backend refactoring, even if the UI restricts use to the superadmin currently.*

## UX / Navigation Logic
- Persistent left-rail navigation layout.
- Dashboard serves as the default landing page.
- Clean, professional, B2B aesthetic. Focus on data density, readability, scannability, and operational efficiency over marketing flair.

## AI Copilot Features (MVP Constraints)
- Asynchronous email drafting contextualized by buyer and active stage.
- Specific document summarization.
- *Implementation Logic:* All generative outputs arrive in a "Draft/Review" state explicitly demarcated from final canonical data.

## Acceptance Criteria for MVP
- **Deal Management:** Seller can successfully initialize and access a single active deal workspace.
- **Buyer Tracking:** Seller can create, edit, and track multiple buyers, and manually move them across predefined M&A pipeline stages (Kanban or List).
- **Document Control:** Seller can securely upload files to private storage, categorize them into folders, and retrieve them via signed URLs while backend RLS prevents unauthorized access.
- **Interactions:** Seller can manually log communication events (calls, emails) against specific buyers.
- **Task Execution:** Seller can create structured tasks, self-assign them (as the superadmin), and mark them complete to track execution progress. Multi-user assignment is architecturally prepared but not required functionally in MVP.
- **AI Copilot Loop:** Seller can trigger specific AI actions (e.g., draft email, summarize document). The system successfully queues the job, runs it asynchronously, and presents the output in a UI review queue for the Seller to explicitly approve or discard.
- **Dashboard Visibility:** System automatically renders a live dashboard summary derived directly from the system-of-record entities (active buyers, recent logs, pending tasks).

## Phase 2 / Phase 3 Expansion Boundaries
- **Phase 2 (Operational Collaboration):** Introduce Internal Team and Advisor roles to the UI. Enable multi-player internal operations, review queues, and task delegation.
- **Phase 3 (Externalization):** Introduce the Buyer role. Expose the external Buyer Portal enabling counterparts to view permissioned documents and submit Due Diligence Q&A directly. Enable multi-deal capabilities for broader advisory use.
