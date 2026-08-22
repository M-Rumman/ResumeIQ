---
kind: logging_system
name: Console-Based Logging with Ad-Hoc Structured Observability
category: logging_system
scope:
    - '**'
source_files:
    - project/api/_lib/aiObservability.ts
    - project/api/_lib/analysis-engine/pipeline.ts
    - project/api/_lib/analysis-engine/jdParser.ts
    - project/api/_lib/analysis-engine/matcher.ts
    - project/api/_lib/billing.ts
    - project/api/_lib/billingPersistence.ts
    - project/api/_lib/dailyUsage.ts
    - project/api/_lib/geminiJobMatch.ts
    - project/api/_lib/jobMatch.ts
    - project/src/context/BillingContext.tsx
    - project/src/pages/ResumeAnalyzerPage.tsx
---

## What system/approach is used

The repository has **no dedicated logging framework or library**. All output goes through Node/JS built-in `console` methods (`console.log`, `console.info`, `console.warn`, `console.error`). There are no logging dependencies in `package.json` (no `winston`, `pino`, `bunyan`, `log4js`, etc.), and no logger initialization, configuration, or transport wiring anywhere in the codebase. The only structured-logging helper is a small ad-hoc module `project/api/_lib/aiObservability.ts` that emits JSON objects via `console.info`.

## Key files and packages

- `project/api/_lib/aiObservability.ts` — the only shared logging utility. It defines an `AiObservabilityContext` carrying `requestId` and `startedAt`, and exposes `logAiEvent(context, event, metadata)` which prints a single info line containing `{ requestId, event, elapsedMs, ...metadata }`. A helper `textMetadata(value)` returns `{ chars, bytes }` for payload size tracking. Its file-level comment explicitly states it is metadata-only telemetry and must not include resume/prompt/model content.
- `project/api/_lib/analysis-engine/pipeline.ts` — emits step-level trace logs using `[analysis-trace]` tags around JD parsing, matcher/rewriter phases, and overall pipeline start/end, including `durationMs` timing.
- `project/api/_lib/analysis-engine/jdParser.ts`, `matcher.ts` — emit domain-specific warnings/errors prefixed by `[jdParser]`, `[matcher]`.
- `project/api/_lib/billing.ts`, `billingPersistence.ts`, `dailyUsage.ts`, `geminiJobMatch.ts`, `jobMatch.ts` — emit errors/warnings under `[billing]`, `[dailyUsage]`, `[gemini-job-match]`, `[job-match]` prefixes.
- Frontend: `project/src/context/BillingContext.tsx`, `project/src/pages/ResumeAnalyzerPage.tsx`, `project/src/lib/supabaseConfig.js`, `project/src/utils/extractDocxText.js`, `project/src/utils/extractPdfText.js` — use plain `console.*` calls directly; no shared client logger exists.

## Architecture and conventions

- **No central logger**: Every module imports nothing for logging and calls `console.*` directly. There is no logger singleton, no log level configuration, no formatter, and no sink abstraction.
- **Tagged prefix convention**: Logs use bracketed module/domain tags as the first argument, e.g. `[pipeline]`, `[analysis-trace]`, `[jdParser]`, `[matcher]`, `[billing]`, `[dailyUsage]`, `[gemini-job-match]`, `[job-match]`, `[ResuV]`. This is the de facto way to identify the source of a log line.
- **Structured fields via object literals**: When extra context is needed, a second argument is passed as a plain object (e.g. `{ status, model, detail }` in `geminiJobMatch.ts`; `{ requestId, event, elapsedMs, ...metadata }` in `aiObservability.ts`). This makes Vercel/Node console output parseable as JSON but is not enforced by any type system.
- **Timing traces**: The analysis engine uses `Date.now()` deltas printed inline as `durationMs=<ms>` within `[analysis-trace]` messages rather than a timer utility.
- **Request correlation**: `AiObservabilityContext.requestId` is the only cross-cutting correlation key; it is passed into `logAiEvent` so AI-related events can be grouped by request.
- **Frontend vs backend split**: Backend API routes (`api/_lib/*`) do all the logging; the React frontend (`src/*`) only uses bare `console.*` calls scattered across components and utilities.

## Conventions and constraints

Observed patterns (descriptive):
- Errors go through `console.error`, warnings through `console.warn`, informational/status through `console.info`, and debug/tracing through `console.log` (often tagged `[DEBUG]`).
- Error logs typically pass both a string tag and the error object as separate arguments (e.g. `console.error('[billing/getProfileBilling]', message, err)`).
- The `aiObservability` module enforces a data-safety constraint at the source: its JSDoc comment requires that resume text, prompts, and model responses never be included in observability logs — only metadata like request IDs, event names, and timing.
- No log level filtering is implemented; every `console.*` call always emits to stdout/stderr regardless of environment.
- No redaction, sampling, or batching logic exists outside the explicit `textMetadata` helper in `aiObservability.ts`.

Enforced rules:
- None beyond the TypeScript compiler catching type mismatches on the `AiObservabilityContext` shape and the `Record<string, unknown>` metadata parameter in `logAiEvent`. There are no ESLint rules, lint configs, or runtime checks that enforce logging style or forbid `console.*` usage.