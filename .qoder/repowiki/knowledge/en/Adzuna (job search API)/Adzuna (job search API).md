---
kind: external_dependency
name: Adzuna (job search API)
slug: adzuna
category: external_dependency
category_hints:
    - vendor_identity
scope:
    - '**'
source_files:
    - project/.env.example
    - project/api/_lib/jobMatch.ts
---

### Role
- Job listing source for the Job Match feature. Credentials `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` are read from environment and used to query Adzuna's public API alongside Greenhouse/Lever/Ashby board registries and Pakistan public feeds.

### Durable notes
- Only US public ATS boards and explicitly documented public RSS/JSON feeds are supported; scraping private HTML pages is disallowed by the codebase comments.