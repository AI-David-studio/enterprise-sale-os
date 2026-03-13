# Vertex AI Runtime Setup & Integration Fix Plan

## 1. PURPOSE OF THIS PLAN
This plan outlines the specific, narrow steps required to transition Stage 4 from its current "scaffolded" state to a fully operational, runtime-ready Vertex AI integration. Currently, the Stage 4 schema, security boundaries, asynchronous (`ai_jobs` / `ai_outputs`), and UI review queue (`/ai-review`) exist and function correctly. However, the actual generative execution inside `src/actions/ai.ts` is mocked. This document defines the exact checklist to replace those mocks with genuine, secure Google Cloud API calls while strictly preserving the human-in-the-loop safety boundaries.

## 2. CURRENT STATUS SUMMARY
- **What is Built & Working:**
  - `ai_jobs` and `ai_outputs` tables with strict deal-isolated RLS.
  - `/ai-review` queue UI in Russian.
  - Generative triggers wired into the Vault and Buyer detail views.
  - Asynchronous background execution pattern mapping.
- **What Remains Mocked (Blocked):**
  - The functions `requestAISummarization` and `requestAIEmailDraft` substitute a real Vertex AI payload with a hardcoded static string.
- **Why Stage 4 is Not Fully Accepted:**
  - Code scaffolding does not prove integration viability. Stage 4 cannot be fully accepted until a real generative payload successfully originates from Vertex AI and lands safely in `ai_outputs`.

## 3. REQUIRED GOOGLE CLOUD PREREQUISITES
Before touching the codebase, the following must exist in a Google Cloud environment:
1. **Google Cloud Project:** An active billable project.
2. **Vertex AI API Enabled:** `aiplatform.googleapis.com` must be activated.
3. **Region Selected:** A generative-supported region (e.g., `us-central1` or `europe-west4`).
4. **Service Account:** A dedicated IAM entity (e.g., `vertex-copilot-sa@<project-id>.iam.gserviceaccount.com`).
5. **IAM Role:** The Service Account requires, at minimum, `roles/aiplatform.user` (Vertex AI User).
6. **Authentication Strategy:** Exported JSON Key file for the Service Account to be securely passed into the local server runtime.

## 4. REQUIRED ENV VARIABLES / CONFIG
The following configuration must be added to `.env.local`:

- `GOOGLE_CLOUD_PROJECT_ID` *(Mandatory)* - The ID of the GCP project.
- `GOOGLE_CLOUD_LOCATION` *(Mandatory)* - The chosen Vertex AI region.
- `VERTEX_MODEL_NAME` *(Mandatory)* - The explicitly configured model ID (e.g., `gemini-1.5-flash`). This prevents silently hardcoding the model directly into API calls.
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` *(Mandatory, Secret)* - The stringified Service Account JSON file text for local/dev runtime. **Must remain strictly server-side and `.env.local` must never be committed. Future cloud deployment secret handling strategies are deferred and out of scope for this task.**

## 5. CURRENT MOCK VS REQUIRED REPLACEMENT
- **Mocked Behavior:** Currently, `src/actions/ai.ts` sets `job.status` to `processing`, pauses, injects a static string into `ai_outputs`, and resolves.
- **Replacement Behavior:** We will strictly adopt the official Node SDK (`@google-cloud/vertexai`) as the single approved integration path. No REST/fetch wrappers or multi-option ambiguity is permitted.
- **Unchanged Behavior:** The code that creates `ai_jobs`, the `catch` blocks that log to `error_message`, the code that inserts into `ai_outputs`, and the requirement that default language generation rules dictate Russian outputs *must* remain totally unmodified.

## 6. APPROVED RUNTIME EXECUTION FLOW
1. **Trigger:** Seller clicks "Сгенерировать резюме" (using already-available document text payloads; Stage 4 strictly excludes building any new OCR or complex document parsing subsystems) or "Черновик письма".
2. **Job Staging:** Server action creates `ai_jobs` [status: `pending` -> `processing`]. Async behavior remains minimal and pragmatic—no advanced queue infrastructure, no agent orchestrators, and no broader background workflows are introduced.
3. **Invocation:** Server action invokes the `@google-cloud/vertexai` SDK safely on the backend, authenticated via the parsed `GOOGLE_APPLICATION_CREDENTIALS_JSON` and targeting `VERTEX_MODEL_NAME`.
4. **Resolution:** The generated text is immediately inserted into `ai_outputs` [status: `pending_review`].
5. **Human Gate:** Seller reviews the draft in `/ai-review`.
6. **Enforcement:** Seller explicitly clicks "Одобрить" (Approve) or "Отклонить" (Discard). There is *zero* automated routing to `communications` logs, `documents`, or outbox processors.

## 7. MINIMUM IMPLEMENTATION WORK REQUIRED
1. **Cloud Setup:** Provision GCP, enable Vertex AI, generate SA Key.
2. **Env Setup:** Append `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_CLOUD_LOCATION`, `VERTEX_MODEL_NAME`, and `GOOGLE_APPLICATION_CREDENTIALS_JSON` to `.env.local`.
3. **Dependency:** Install `@google-cloud/vertexai`.
4. **Code Replacement:** Rewrite logic using the Vertex AI SDK within `requestAISummarization` and `requestAIEmailDraft` inside `src/actions/ai.ts`.
5. **Safety Validation:** Ensure the resulting prompt strictly enforces Russian outputs.

## 8. VERIFICATION CHECKLIST
- [ ] GCP project, API, and IAM role validated.
- [ ] `.env.local` accurately loaded without exposing secrets to `process.env.NEXT_PUBLIC_`.
- [ ] `npm install @google-cloud/vertexai` completes successfully.
- [ ] Code modifications applied narrowly to `src/actions/ai.ts`.
- [ ] Valid Vertex AI completion occurs for "Document Summarization".
- [ ] Valid Vertex AI completion occurs for "Email Drafting".
- [ ] Results land correctly in the `/ai-review` UI queue.
- [ ] Resulting generative text defaults to Russian natively.
- [ ] Explicit check proves zero automated external sends or database overrides occur.
- [ ] Stages 1, 2, and 3 continue to function normally.

## 9. RISKS / FAILURE POINTS
- **Wrong GCP Configuration:** Missing billing or disabled APIs yielding `403` errors.
- **Env Leakage:** Prefixing secret keys with `NEXT_PUBLIC_` accidentally shipping them to the browser payload.
- **Incomplete Mock Removal:** Accidentally leaving static strings active in edge-case fallback catches.
- **Language Failure:** Failing to instruct the Vertex AI system prompt explicitly resulting in English summaries.
- **Safety Bypass:** Unintentionally copying Vertex AI responses directly to the DOM or operational tables before the seller clicks "Одобрить".

## 10. NEXT STEP AFTER THIS PLAN
Upon approval of docs/VERTEX_AI_RUNTIME_SETUP_PLAN.md:
1. Execute this strict runtime setup and integration repair.
2. Rerun the full Stage 4 Review & Acceptance Audit to verify real execution.
3. Only upon full acceptance, advance to Stage 5 planning.
