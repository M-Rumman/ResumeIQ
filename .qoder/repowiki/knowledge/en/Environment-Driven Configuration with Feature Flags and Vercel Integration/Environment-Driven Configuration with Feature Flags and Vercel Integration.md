---
kind: configuration_system
name: Environment-Driven Configuration with Feature Flags and Vercel Integration
category: configuration_system
scope:
    - '**'
source_files:
    - project/.env.example
    - vercel.json
    - project/vercel.json
    - project/vite.config.ts
    - project/shared/supabaseDefaults.js
    - project/src/lib/supabaseConfig.js
    - project/api/_lib/supabaseAdmin.ts
    - project/src/lib/launchConfig.js
    - project/api/_lib/launchMode.ts
    - project/src/lib/paymentsConfig.js
    - project/src/lib/planConfig.js
    - project/src/lib/usageLimits.js
    - project/src/lib/monetizationConfig.js
    - project/api/_lib/appUrl.ts
    - project/api/_lib/openrouter.ts
    - project/api/_lib/lemonSqueezy.ts
---

## Overview

ResumeIQ uses an environment-variable-driven configuration system layered over Vite build-time variables (`VITE_*`) for the browser bundle and Node process.env for serverless API routes. There is no centralized config file or runtime loader — every module reads directly from `import.meta.env` (client) or `process.env` (server), with shared defaults in `shared/supabaseDefaults.js` and per-domain helpers that normalize, validate, and enforce required values.

## Key Files and Packages

- **`.env.example`** — single source of truth documenting every supported variable, split into client (`VITE_`), server-only, and optional sections (Supabase, Upstash Redis, OpenRouter, AI health, job-board registries, Lemon Squeezy).
- **`project/src/lib/supabaseConfig.js`** — normalizes `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, rejects non-Supabase URLs, falls back to defaults in dev, and throws in production if missing.
- **`project/shared/supabaseDefaults.js`** — ships a default Supabase project URL and anon key used as fallbacks when env vars are absent.
- **`project/api/_lib/supabaseAdmin.ts`** — server-side Supabase client; requires `SUPABASE_SERVICE_ROLE_KEY` (throws if missing) and resolves URL/key via `SUPABASE_*` → `VITE_SUPABASE_*` → defaults.
- **`project/src/lib/launchConfig.js`** — exposes `FREE_LAUNCH_MODE` from `VITE_FREE_LAUNCH_MODE === 'true' || '1'`.
- **`project/api/_lib/launchMode.ts`** — server counterpart reading `FREE_LAUNCH_MODE` or `VITE_FREE_LAUNCH_MODE` so one deployment setting controls both client and server.
- **`project/src/lib/paymentsConfig.js`** — derives `PAYMENTS_ENABLED = !FREE_LAUNCH_MODE`; client paywall logic gated by this flag.
- **`project/src/lib/planConfig.js`** — hard-coded plan limits (`FREE_DAILY_RESUME_LIMIT=2`, `FREE_DAILY_INTERVIEW_LIMIT=2`, `FREE_HISTORY_LIMIT=5`) and pricing copy — the single source for free/pro feature caps.
- **`project/src/lib/usageLimits.js`** — client-side usage display; consults billing status when `PAYMENTS_ENABLED`, otherwise returns unlimited access.
- **`project/src/lib/monetizationConfig.js`** — paywall UI constants (`PAYWALL_PREVIEW_PERCENT=40`, `$2 unlock`, `$5/mo Pro`).
- **`project/api/_lib/appUrl.ts`** — resolves canonical app origin: `APP_URL` → `VERCEL_URL` → `https://resuv.app` (production) → `http://localhost:3000`.
- **`project/api/_lib/openrouter.ts`** — reads `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_REQUEST_TIMEOUT_MS` (clamped between 30s–180s); also supports `GEMINI_API_KEY` / `GEMINI_JOB_MATCH_KEYS` for direct Gemini calls.
- **`project/api/_lib/lemonSqueezy.ts`** — reads `LEMON_API_KEY`, `LEMON_WEBHOOK_SECRET`, `VITE_LEMON_STORE_ID`, `VITE_LEMON_UNLOCK_VARIANT_ID`, `VITE_LEMON_PRO_VARIANT_ID`; `assertLemonCheckoutConfig()` throws if any are missing.
- **`vercel.json` (root)** — top-level deploy config that rewrites `/api/*` to `/project/api/*` and sets security headers + CSP.
- **`project/vercel.json`** — per-project deploy config with `maxDuration: 300` on long-running functions, same header/CSP strategy.
- **`vite.config.ts`** — proxies `/api` to `http://localhost:3000` during local dev.

## Architecture and Conventions

### Client vs Server Variable Split
Variables are explicitly prefixed to indicate scope:
- `VITE_*` — injected at build time into the browser bundle via `import.meta.env`.
- Plain `process.env.*` — only available in API routes (e.g. `OPENROUTER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LEMON_*`).
The `.env.example` comments document which variables are "server only" and which must match across client/server (e.g. `PAYMENTS_ENABLED` vs `VITE_PAYMENTS_ENABLED`).

### Fallback-and-Validate Pattern
Every external dependency has a small resolver function that:
1. Reads from env (often with multiple precedence levels, e.g. `SUPABASE_*` then `VITE_SUPABASE_*` then defaults).
2. Validates format (e.g. Supabase URL must contain `.supabase.co`, anon key length ≥ 80, OpenRouter key starts with `sk-or-`).
3. Falls back to defaults in development, throws in production.
This pattern appears in `resolveSupabaseClientConfig`, `getSupabaseAdmin`, `resolveOpenRouterApiKey`, `getLemonConfig`/`assertLemonCheckoutConfig`, and `getAppBaseUrl`.

### Feature Flags Layering
Feature toggles are layered rather than single-source:
- `FREE_LAUNCH_MODE` / `VITE_FREE_LAUNCH_MODE` — global launch switch read by both client (`launchConfig.js`) and server (`launchMode.ts`).
- `PAYMENTS_ENABLED` / `VITE_PAYMENTS_ENABLED` — payment gate; client derives it from `!FREE_LAUNCH_MODE`, server enforces it in `/api/create-checkout`.
- `AI_HEALTH_SECRET` — gates the `/api/ai-health` probe endpoint.
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — optional rate-limit backend; when unset, API routes fall back to in-memory sliding windows.

### Environment-Driven Provider Selection
- **AI providers**: `OPENROUTER_MODEL` overrides the default model; if `GEMINI_API_KEY` is set and the selected model starts with `google/`, the code attempts a native Gemini call before falling back through `MODEL_FALLBACKS`.
- **Job boards**: `ADZUNA_APP_ID`/`KEY`, `GREENHOUSE_BOARD_REGISTRY`, `LEVER_BOARD_REGISTRY`, `ASHBY_BOARD_REGISTRY`, `PAKISTAN_PUBLIC_JOB_FEEDS` are JSON arrays configured entirely via env.
- **Billing**: Lemon Squeezy store/variant IDs are client-visible (`VITE_LEMON_*`), while API keys/webhook secrets are server-only.

### Vercel Deployment Configuration
The root `vercel.json` builds inside `project/`, outputs to `project/dist`, rewrites `/api/:path*` to `/project/api/:path*`, and serves SPA fallback to `/project/dist/index.html`. Security headers and a strict CSP are applied globally. The inner `project/vercel.json` mirrors this structure for direct deployments under `project/`, adding `maxDuration: 300` for the long-running resume analysis and job-match endpoints.

## Conventions and Constraints

- **No runtime config files** — all configuration comes from environment variables; there is no JSON/YAML/TOML config loader.
- **`.env.example` is authoritative** — every supported variable is documented here with its purpose, prefix rules, and default behavior; new variables should be added here first.
- **Production validation is enforced** — missing required keys throw errors at startup or first use (Supabase service role key, OpenRouter key, Lemon Squeezy checkout config). This prevents silent misconfiguration in production.
- **Client/server parity for flags** — launch mode and payments flags exist in both client and server forms; the comment in `.env.example` states they must match when launching payments.
- **Secrets never ship to the browser** — server-only variables (service role key, LEMON_API_KEY, webhook secret, OpenRouter key) are accessed exclusively via `process.env` in `api/_lib/` modules.
- **Optional features degrade gracefully** — Upstash Redis is optional; without it, rate limiting falls back to in-memory windows suitable for single-instance dev.
- **Default project credentials are embedded** — `shared/supabaseDefaults.js` contains a default Supabase project URL and anon key intended for development; production must override via Vercel environment variables.