---
kind: external_dependency
name: Vercel (hosting + serverless functions)
slug: vercel
category: external_dependency
category_hints:
    - client_constraint
scope:
    - '**'
source_files:
    - project/vercel.json
    - package.json
---

### Role
- Deployment target for both the Vite frontend and the Node.js API routes under `project/api/`. Build script uses `vite build` plus prerender SEO steps; runtime uses `@vercel/node` for serverless function execution.

### Durable constraints
- Multi-stage Resume Analysis requests have a browser timeout of 290s (`VITE_AI_ANALYSIS_TIMEOUT_MS=290000`), chosen to stay below Vercel's function duration limit.
- Dev mode available via `npm run dev:vercel` (`vercel dev`).