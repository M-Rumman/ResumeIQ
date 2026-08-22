---
kind: external_dependency
name: Upstash Redis (optional distributed rate limiter)
slug: upstash-redis
category: external_dependency
category_hints:
    - client_constraint
scope:
    - '**'
source_files:
    - project/.env.example
    - project/api/_lib/rateLimit.ts
    - project/api/_lib/ipThrottle.ts
    - project/api/_lib/billingRateLimit.ts
---

### Role
- Optional shared rate limiter for API routes (per-IP throttling, per-user billing rate limits). When `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are unset, all rate limiters fall back to in-memory sliding windows, which are fine for single-instance dev but not multi-region production.

### Durable notes
- All three rate-limiting modules (`rateLimit.ts`, `ipThrottle.ts`, `billingRateLimit.ts`) check for the Upstash env vars first; absence means local-only limits.
- Production deployments on Vercel should configure Upstash to avoid per-function-state drift across replicas.