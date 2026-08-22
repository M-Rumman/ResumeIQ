---
kind: build_system
name: Vite + Vercel Serverless Build Pipeline
category: build_system
scope:
    - '**'
source_files:
    - vercel.json
    - project/package.json
    - project/vite.config.ts
    - project/tsconfig.json
    - project/tsconfig.app.json
    - project/tsconfig.api.json
    - project/tsconfig.node.json
    - project/postcss.config.js
    - project/tailwind.config.js
    - project/scripts/sync-global-jsonld.ts
    - project/scripts/prerender-blog-seo.ts
    - project/scripts/generate-seo-files.ts
---

## Build System Overview

This repository is a **Vite-based React/TypeScript SPA** deployed to **Vercel**, with serverless API routes under `project/api/` handled by `@vercel/node`. The build pipeline is defined entirely through `package.json` scripts and Vercel configuration — there are no Makefiles, Dockerfiles, or custom CI scripts.

## Key Files

- `vercel.json` (root) — top-level Vercel deployment config: `buildCommand: cd project && npm install && npm run build`, output at `project/dist`, rewrites `/api/:path*` → `/project/api/:path*` and all other routes to the SPA `index.html`.
- `project/package.json` — defines `dev`, `build`, `typecheck`, `test:*`, `lint`, `preview` scripts; `build` runs a pre/post-build script chain via `tsx`.
- `project/vite.config.ts` — Vite config with React plugin, dependency optimization (`pdfjs-dist`, `mammoth` included; `lucide-react` excluded), and dev proxy for `/api` → `http://localhost:3000`.
- `project/tsconfig.json` — root project referencing three sub-configs: `tsconfig.app.json` (SPA source in `src/`), `tsconfig.api.json` (serverless handlers in `api/**.ts` + `shared/**/*.js`), `tsconfig.node.json` (Node tooling like `vite.config.ts`).
- `project/postcss.config.js` + `tailwind.config.js` — PostCSS pipeline using Tailwind CSS with autoprefixer.
- `project/scripts/sync-global-jsonld.ts`, `prerender-blog-seo.ts`, `generate-seo-files.ts` — pre/post-build hooks invoked from the `build` script.

## Architecture & Conventions

### Dual-target TypeScript compilation
The project uses **three separate tsconfigs** so that client code (`src/`) targets ES2020+DOM while serverless API code (`api/`) targets ES2022+Node. Both share strict mode, isolated modules, and bundler-style module resolution. Type checking is enforced via `npm run typecheck` which runs `tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.api.json`.

### Build pipeline (npm scripts)
The production build is a multi-stage chain:
1. `tsx scripts/sync-global-jsonld.ts` — syncs global JSON-LD metadata before build.
2. `vite build` — compiles React SPA into static assets under `project/dist`.
3. `tsx scripts/prerender-blog-seo.ts` — prerenders blog pages for SEO.
4. `tsx scripts/generate-seo-files.ts` — generates additional SEO files post-build.

Development uses `vite` directly (`npm run dev`); local Vercel development is available via `npm run dev:vercel` (`npx vercel dev`).

### Serverless API routing
API endpoints live as individual files under `project/api/` (e.g., `analyze-resume.ts`, `job-match.ts`, `billing/status.ts`). Vercel treats each file as a Node.js serverless function. The root `vercel.json` rewrites incoming `/api/*` requests to the corresponding handler under `project/api/`, while all non-API routes fall back to the SPA's `index.html` for client-side routing.

### Styling pipeline
Tailwind CSS is processed through PostCSS with `autoprefixer`. Custom theme tokens (fonts, colors, border radii) are centralized in `tailwind.config.js`. Source files scanned for utility classes are limited to `./index.html` and `./src/**/*.{js,ts,jsx,tsx}`.

### Testing
Tests are executed via `tsx` against standalone test runners under `project/tests/` (resume pipeline tests, AI persistence tests). There is no test framework configured in `package.json`; tests use plain Node/TS with `tsx` as the runner. Scripts include `test:resume-pipeline`, `test:jd-parser`, `test:resume-extraction`, `test:matcher`, `test:evaluator`.

## Conventions & Constraints

- **No monorepo tooling**: everything lives under `project/`; the root `vercel.json` is the single entry point that `cd`s into `project/` before building.
- **Strict TypeScript everywhere**: all three tsconfigs enforce `strict: true`, `isolatedModules: true`, `skipLibCheck: true`, and `moduleResolution: "bundler"`.
- **ESM-only**: `package.json` sets `"type": "module"`; configs use `.mjs`-style `export default` syntax.
- **Security headers baked into deployment**: `vercel.json` applies CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, and X-Content-Type-Options to all paths.
- **CSP restricts external services**: only Google Analytics, Clarity, Supabase, Lemon Squeezy, and Google Fonts are whitelisted via `connect-src`, `script-src`, `style-src`, `font-src`, `img-src`, `frame-src` directives.
- **Dev proxy convention**: during local development, `/api` requests are proxied to `http://localhost:3000` so the Vite dev server can reach the Vercel functions locally.
- **Dependency optimization**: `pdfjs-dist` and `mammoth` are explicitly included in `optimizeDeps.include` (they are large native-heavy packages), while `lucide-react` is excluded to avoid unnecessary pre-bundling.
- **No containerization**: there are no Dockerfiles; deployment is purely Vercel serverless + static asset hosting.
- **No CI/CD pipeline file**: no GitHub Actions, CircleCI, or similar config exists in the repo; builds rely on Vercel's built-in pipeline triggered by pushes to `main`.