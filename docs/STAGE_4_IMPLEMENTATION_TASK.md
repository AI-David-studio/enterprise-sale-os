# Stage 4 Implementation Task

## 1. STAGE NAME
**Stage 4: Intelligence + AI Copilot Baseline**

## 2. STAGE OBJECTIVE
The objective of Stage 4 is to introduce the MVP AI layer to the seller operating system. This layer operates strictly as a "co-pilot," assisting the seller with specific, constrained tasks. All AI generation happens as a background asynchronous process. Crucially, all AI outputs are considered drafts and require explicit human review and approval before becoming canonical data or being utilized. Autonomous actions are strictly forbidden.

## 3. IN-SCOPE FOR STAGE 4
- **AI Job / Output Foundation:** 
  - Database schema for `ai_jobs` (to track async request state) and `ai_outputs` (to stage the drafted content).
  - Background processing logic to fulfill `ai_jobs` without blocking the main UI thread.
- **Server-Side / Edge AI Orchestration:**
  - Secure server-side or edge-function handler to communicate with the AI provider.
  - Safe payload passing from the product to the AI backend.
- **Vertex AI Integration Baseline:**
  - Connecting safely to Vertex AI.
  - Basic prompting structure mapped from the active `deal` / `buyer` / `document` context.
- **MVP AI Actions (Exactly Two):**
  1. *Document Summarization*
  2. *Email Drafting Text*
- **Review Queue UI Surface:**
  - A central UI `/ai-review` for the seller to view, approve, or discard pending `ai_outputs`.
- **Russian-First UI:**
  - All review queue UI surfaces and user-facing AI outputs must default to Russian.

## 4. OUT-OF-SCOPE FOR STAGE 4
- Buyer-facing portal or external sharing modules.
- Due diligence (DD) response engines.
- Offer, IOI, or LOI negotiation AI and scoring.
- Buyer scoring algorithms or valuation insights generation.
- Due diligence (DD) AI answer generation or Q&A engines.
- Advanced recommendation systems.
- Automated or autonomous email sending.
- Autonomous state mutations (e.g., automatically changing pipeline stages based on AI inference).
- Direct Gmail / Outlook OAuth sync.
- Firebase deployment setup.
- Advanced analytics or unstructured data mining.
- Agent chains or multi-step autonomous workflows.

## 5. STAGE 4 DATA ENTITIES
The following database entities are introduced to fulfill the intelligence layer safely:

1. **`ai_jobs`**
   - *Purpose:* Tracks the lifecycle of an async LLM request (e.g., pending, processing, completed, failed) to prevent blocking the UI.
   - *Stage 4 Justification:* Necessary to provide a reliable seller experience while waiting for Vertex AI responses.
   - *Deferred:* Retries, complex priority queues, or dead-letter handling are deferred unless trivially solved in MVP.
2. **`ai_outputs`**
   - *Purpose:* The staging table for generative data returned by Vertex AI.
   - *Stage 4 Justification:* Enforces the human-in-the-loop directive. No AI data hits a canonical record (like updating a document or a communication log) without passing through here first.
   - *Deferred:* Linking outputs to complex multi-step workflows or autonomous triggers is strictly forbidden.

## 6. VERTEX AI ROLE / ORCHESTRATION MODEL
- **Provider:** Google Vertex AI is the required intelligence backend.
- **Architecture:** Execution must happen behind a server-side boundary (e.g., Next.js Server Actions, API Routes, or Supabase Edge Functions). Direct client-side calls to Vertex AI are forbidden to protect credentials and manipulation.
- **Rules of Engagement:** 
  - Vertex AI only receives the context necessary to fulfill one of the two MVP actions.
  - The integration acts solely as a text generator. It has no independent database write access outside of landing the payload into the `ai_outputs` table.

## 7. REVIEW QUEUE MODEL
- **Creation:** A user triggers an action in the UI -> An `ai_job` is created -> The backend invokes Vertex AI -> The result is inserted into `ai_outputs`.
- **Review:** The seller visits `/ai-review` to see a queue of pending `ai_outputs`.
- **Action:** 
  - **Approve:** The data is copied to its destination (e.g., clipboard, or attached to a `documents` record), and the output is marked verified/resolved.
  - **Discard:** The drafted output is permanently rejected/deleted.
- **Constraint:** Approval is restricted to the human superadmin only.

## 8. MVP AI ACTIONS FOR STAGE 4
The implementation is strictly limited to these two actions:

**A. Document Summarization**
- *Trigger:* Seller clicks "Сгенерировать резюме" (Generate Summary) on a document row in Vault.
- *Input Context:* Extracted text or accessible payload of the document.
- *Output Destination:* Drafted summary lands in `ai_outputs`.
- *Review Requirement:* Seller reads the summary in `/ai-review` and clicks "Одобрить" (Approve) to attach it to the `documents` metadata.
- *Why:* Quickly distills legal or financial documents.

**B. Email Drafting**
- *Trigger:* Seller clicks "Черновик письма" (Draft Email) on a Buyer detail page.
- *Input Context:* Buyer pipeline stage, recent `communications` log, deal context.
- *Output Destination:* Drafted text lands *only* in `ai_outputs`.
- *Review Requirement:* Seller views the email body in `/ai-review`. Seller explicitly clicks an action to copy the text to their clipboard, or optionally explicitly logs it manually into `communications` via human confirmation. There is *no* automatic write into `communications`, and the system *never* sends the email.
- *Why:* Removes administrative friction of repetitive status updates without risking rogue messaging.

## 9. MINIMAL UI SURFACES FOR THIS STAGE
All user-facing text must be Russian.

- **`/ai-review` (Очередь проверки ИИ):**
  - *Purpose:* The seller's dedicated control center for AI drafts.
  - *Actions:* View drafted summaries or email text; Approve; Discard.
  - *Intentionally Excluded:* "Auto-Apply All" buttons, setting up autonomous triggers, AI chatting window.

## 10. STAGE 4 FUNCTIONAL EXPECTATIONS
- The seller can invoke summarization on a document.
- The seller can invoke an email draft generation for a buyer.
- AI jobs run asynchronously. The UI should not hang waiting for Vertex AI.
- Generated outputs predictably land in the review queue.
- The seller can approve or discard these drafts.
- No autonomous email sending or canonical state mutation occurs without the seller's explicit click on "Approve".

## 11. ACCEPTANCE CRITERIA
Stage 4 is successful only if all the following are true:
1. `ai_jobs` and `ai_outputs` tables are implemented and function correctly.
2. The Vertex AI integration path securely authenticates and returns responses.
3. The AI review queue works, demonstrating human-in-the-loop control.
4. Document summarization and email drafting workflows operate as intended within strict limits.
5. All visible AI UI elements and default generative text are in Russian.
6. Absolute proof that no autonomous AI operations or outbound actions exist.
7. Stages 1–3 remain functional and isolated.

## 12. STAGE RISKS
- **AI Scope Expansion:** Giving Vertex AI too much context or trying to build autonomous agents that determine the next "best action."
- **Unsafe Auto-Actions:** Accidentally bypassing `ai_outputs` and writing directly to canonical operational data.
- **Hallucination Risk:** Mitigation relies on the strict human-in-the-loop review queue model.
- **Language Leakage:** Prompting issues resulting in Vertex AI responding in English.
- **Secrets:** Storing or exposing Vertex AI credentials on the client.
- **Overbuilt Orchestration:** Building complex event buses instead of simple polling or webhook callbacks for async resolution.

## 13. HANDOFF TO NEXT STAGE
Upon successful implementation and acceptance audit of Stage 4, the project will move sequentially to:
**Stage 5 Planning: Dashboard Aggregation & Operational Polish.**
*(Execution of Stage 5 strictly requires its own approved planning document first).*
