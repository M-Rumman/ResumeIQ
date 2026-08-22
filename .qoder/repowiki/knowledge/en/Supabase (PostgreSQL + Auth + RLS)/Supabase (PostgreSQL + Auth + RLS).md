---
kind: external_dependency
name: Supabase (PostgreSQL + Auth + RLS)
slug: supabase
category: external_dependency
category_hints:
    - vendor_identity
    - auth_protocol
scope:
    - '**'
source_files:
    - project/.env.example
    - project/src/lib/supabase.js
    - project/api/_lib/supabaseAdmin.ts
    - project/supabase/README.md
    - project/supabase/migrations/20260601120000_rls_security_baseline.sql
---

### Role
- Backend database and auth provider for ResuV. Stores user profiles, subscription state (`lemonsqueezy_*` columns), testimonial submissions, daily AI usage counters, job search history, and paywall flags.
- Client SDK (`@supabase/ssupabase-js`) is initialized at build time via `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; server-side admin calls use `SUPABASE_SERVICE_ROLE_KEY`.

### Integration points
- Frontend: `project/src/lib/supabase.js`, `project/src/lib/createUserProfile.ts`, `project/src/lib/emailVerification.ts`, `project/src/lib/passwordReset.ts`, `project/src/lib/manageSubscription.ts`.
- Server API routes: `project/api/_lib/supabaseAdmin.ts` (service-role writes to profile billing fields).
- Schema: versioned SQL migrations under `project/supabase/migrations/` (RLS policies, billing triggers, `profiles` table with `is_pro` / `subscription_expires_at` / `lemonsqueezy_*` columns, `testimonials`, `daily_free_ai_usage`, `job_match_search_history`).

### Durable notes
- Supabase URL must be the project URL (`https://your-project.supabase.co`), not the Vercel app URL — enforced in `.env.example`.
- RLS policies are applied via migration order; see `project/supabase/README.md` for the required sequence before launch.
- Billing columns were migrated from Paddle (`paddle_*`) to Lemon Squeezy (`lemonsqueezy_*`); do not reference removed Paddle artifacts.