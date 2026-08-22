---
kind: error_handling
name: Structured Pipeline Errors, Safe API Responses, and User-Friendly Error Hints
category: error_handling
scope:
    - '**'
source_files:
    - project/api/_lib/openrouter.ts
    - project/api/_lib/safeError.ts
    - project/api/analyze-resume.ts
    - project/api/_lib/analysis-engine/jdParser.ts
    - project/api/_lib/analysis-engine/pipeline.ts
    - project/src/lib/aiErrorHints.ts
    - project/src/lib/authErrors.js
---

## Overview

ResumeIQ uses a layered error-handling strategy across its Vercel serverless API routes and Next.js frontend. The backend centralizes AI pipeline failures in a typed `AiPipelineError`, maps provider HTTP status codes into stable error codes, and returns only safe, user-facing messages via a shared `safeError` helper. The frontend translates raw error strings from Supabase and OpenRouter into localized, actionable hints for end users.

## Backend: `AiPipelineError` as the canonical failure type

- **Definition** — `project/api/_lib/openrouter.ts` defines `class AiPipelineError extends Error` with three fields: `stage: AiPipelineStage` (`parser | verification | analyzer | rewriter | validation | planner`), `code: string`, and `message`. A type guard `isAiPipelineError(err)` checks `err.name === 'AiPipelineError'`.
- **Creation points** — Every LLM call goes through `callOpenRouter`, which converts provider responses into `AiPipelineError` instances:
  - `401/403` → `UNAUTHORIZED_API_KEY`
  - `429` → `PROVIDER_RATE_LIMIT`
  - `402` → `PROVIDER_INSUFFICIENT_CREDITS`
  - `400` → `PROVIDER_BAD_REQUEST`
  - `404` → `PROVIDER_MODEL_NOT_FOUND`
  - Empty response → `PROVIDER_ERROR`
  - Retries are attempted for retryable statuses before throwing.
- **Propagation** — Downstream modules (`jdParser.ts`, `pipeline.ts`, `evaluator.ts`) throw `AiPipelineError` for domain-level failures (e.g. `MALFORMED_JSON_OUTPUT`, `JD_PARSING_FAILED`, `INVARIANT_FAILED`). They wrap unexpected generic errors with a stage-specific code so callers never see raw stack traces.
- **API boundary handling** — In `api/analyze-resume.ts`, the route catches `AiPipelineError` via `isAiPipelineError` and responds with `502 { error, pipelineError: { stage, code } }`, logging the event through `logAiEvent`. Non-pipeline errors are logged with `requestId` and also return `502`.

## Centralized safe client responses

`project/api/_lib/safeError.ts` provides:
- `CLIENT_ERRORS` — a `const` map of route names to sanitized user-facing messages (e.g. `AI_ANALYSIS`, `CHECKOUT`, `INTERNAL`). Routes use these instead of leaking internal details.
- `respondError(res, status, message)` — writes `{ error: message }` JSON with the given status.
- `logApiError(route, err, extra?)` — logs the raw error to `console.error` with a `[route]` prefix.

Every API handler imports these helpers and uses them to avoid returning raw exception objects or stack traces to clients.

## Frontend: human-friendly error hinting

- `project/src/lib/aiErrorHints.ts` — `getAiErrorHint(errorMessage)` inspects the raw error string and returns a contextual hint based on environment (`window.location.hostname.endsWith('.vercel.app')` vs local dev). It distinguishes rate limits (`429` / `rate-limit`), unauthorized key errors (`401` / `unauthorized` / `user not found`), missing config (`openrouter_api_key` / `not configured`), and unavailable models (`404 no endpoints`).
- `project/src/lib/authErrors.js` — `getLoginErrorMessage`, `getSignupErrorMessage`, and `isAuthEmailDeliveryError` parse Supabase auth error strings into friendly messages (invalid credentials, unverified email, weak passwords, duplicate accounts, rate-limited signups, disabled signup).
- These functions are consumed by UI components/pages to display actionable feedback rather than raw provider errors.

## Conventions observed

1. **Never swallow errors silently** — `catch` blocks either rethrow wrapped `AiPipelineError` instances or convert unknown errors into one with a descriptive code.
2. **Stable error codes over messages** — Provider-specific messages are logged; clients receive a stable `pipelineError.code` plus a generic user message.
3. **Separation of concerns** — Infrastructure (`openrouter.ts`) handles provider errors; business logic (`analysis-engine/*`) handles domain invariants; routes handle HTTP mapping; the frontend handles UX hints.
4. **Graceful degradation** — Database persistence failures after a successful AI analysis are logged but do not prevent returning the result to the user (`analyze-resume.ts` lines 151–158).
5. **Rate limiting is surfaced explicitly** — `Retry-After` headers are set on `429` responses, and free-tier usage limits return a specific message via `respondError`.
6. **Environment-aware hints** — The same error produces different guidance depending on whether the user is on Vercel production or local development.
7. **No `throw new Error(...)` without wrapping** — Raw `Error` throws are rare; most failures go through `AiPipelineError` or `respondError`.

## Key files

- `project/api/_lib/openrouter.ts` — `AiPipelineError` class, `isAiPipelineError`, `callOpenRouter` with provider error mapping and retry logic
- `project/api/_lib/safeError.ts` — `CLIENT_ERRORS`, `respondError`, `logApiError`
- `project/api/analyze-resume.ts` — Route-level error handling, `AiPipelineError` catch, graceful DB persistence failure
- `project/api/_lib/analysis-engine/jdParser.ts` — Throws `AiPipelineError` for malformed LLM output
- `project/api/_lib/analysis-engine/pipeline.ts` — Throws `AiPipelineError` for invariant/validation failures
- `project/src/lib/aiErrorHints.ts` — Frontend OpenRouter error-to-hint mapper
- `project/src/lib/authErrors.js` — Frontend Supabase auth error-to-message mapper

## Applicable scope

This pattern applies to all serverless API routes under `project/api/*.ts` that call AI providers or persist data, and to all frontend pages/hooks that surface authentication or AI-related errors to users.