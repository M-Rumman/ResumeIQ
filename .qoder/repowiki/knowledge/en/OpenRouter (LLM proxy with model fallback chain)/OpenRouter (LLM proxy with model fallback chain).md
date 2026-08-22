---
kind: external_dependency
name: OpenRouter (LLM proxy with model fallback chain)
slug: openrouter
category: external_dependency
category_hints:
    - vendor_identity
    - sdk_real_api
    - framework_behavior
scope:
    - '**'
source_files:
    - project/.env.example
    - project/api/_lib/openrouter.ts
    - project/api/_lib/aiObservability.ts
    - project/api/_lib/aiPersistence.ts
    - project/api/_lib/aiValidation.ts
---

### Role
- Primary LLM gateway for resume analysis pipeline (JD parsing, requirement matching, bullet rewrites, evidence validation). Also used by `/api/interview-prep.ts` and `/api/job-match.ts`.
- Key: `OPENROUTER_API_KEY` (must start with `sk-or-`). Optional `OPENROUTER_MODEL` overrides default.

### Durable integration shape
- Model fallback chain: primary model → 5 fallback models on rate-limit / failure; retryable errors are detected and retried automatically.
- Native Gemini bypass: when `GEMINI_API_KEY` is set, Gemini is called directly instead of through OpenRouter.
- Observability: request/response logging goes through `aiObservability.ts` / `aiPersistence.ts`; health probe at `/api/ai-health` guarded by `AI_HEALTH_SECRET`.
- Errors surface as typed `AiPipelineError` codes (e.g. `MODEL_UNAVAILABLE`, `RATE_LIMITED`, `INVALID_RESPONSE`) rather than raw HTTP status codes.

### Verify exact model names and fallback order against official OpenRouter docs.