---
kind: dependency_management
name: npm-based dependency management with lockfile and Vercel deployment
category: dependency_management
scope:
    - '**'
source_files:
    - project/package.json
    - project/package-lock.json
    - project/.gitignore
    - project/tsconfig.json
    - project/tsconfig.app.json
    - project/tsconfig.api.json
    - vercel.json
---

## System / Approach

The repository uses **npm** as its package manager for a single Node.js/TypeScript project located under `project/`. Dependencies are declared in `project/package.json` and pinned to exact resolved versions by `project/package-lock.json` (lockfileVersion 3). The `node_modules/` directory is present locally but is excluded from version control via `.gitignore`, so the lockfile is the source of truth for reproducible installs.

There is no vendoring strategy, no private npm registry configuration, and no `.npmrc` file — packages are fetched directly from the public `https://registry.npmjs.org/` endpoint, as evidenced by every `resolved` URL in the lockfile. There is also no `pnpm-lock.yaml`, `yarn.lock`, or `go.mod`; references to pnpm/yarn logs in `.gitignore` are generic boilerplate only.

## Key Files

- `project/package.json` — declares runtime dependencies (`react`, `@supabase/supabase-js`, `pdfjs-dist`, `mammoth`, `lucide-react`, `jspdf`, `clarity-js`, `react-ga4`, `@xenova/transformers`) and dev dependencies (`vite`, `typescript`, `eslint`, `tailwindcss`, `@vercel/node`, `tsx`, `vercel`, etc.).
- `project/package-lock.json` — full deterministic lockfile used by npm; contains integrity hashes and exact resolved URLs for all transitive dependencies.
- `project/.gitignore` — excludes `node_modules`, `dist`, `.env*`, `.vercel`, and various IDE/debug artifacts.
- `project/tsconfig.json`, `tsconfig.app.json`, `tsconfig.api.json` — TypeScript configs that drive the `typecheck` script which runs `tsc --noEmit` against both app and API projects, acting as a soft constraint on dependency type compatibility.
- `vercel.json` (root) — tells Vercel to deploy the `project/` directory as the app root, so the same `package.json` + lockfile are used at build time.

## Architecture and Conventions

- **Single workspace**: All code lives in one `project/` folder; there are no monorepo tools (no lerna, nx, turborepo, pnpm workspaces).
- **Version ranges use caret (`^`)**: Every entry in `dependencies` and `devDependencies` uses a caret range (e.g. `"react": "^18.3.1"`), allowing minor/patch updates while preventing major bumps. The lockfile pins the exact installed versions.
- **Dev vs runtime split**: Runtime-only libraries (React, Supabase client, PDF/doc parsers, analytics) go in `dependencies`; tooling (Vite, TypeScript, ESLint, Tailwind, tsx, vercel CLI) goes in `devDependencies`.
- **Build-time scripts**: The `build` script chains `tsx scripts/sync-global-jsonld.ts && vite build && tsx scripts/prerender-blog-seo.ts && tsx scripts/generate-seo-files.ts`, meaning some scripts depend on dev-only packages being available during CI builds.
- **Test execution**: Tests run via `tsx` invoked through `node node_modules/tsx/dist/cli.mjs ...`, bypassing any global `tsx` installation and relying on the locked devDependency.
- **No vendored third-party code**: No `vendor/`, `third_party/`, or inline copies of libraries exist; everything comes from npm.

## Conventions and Constraints

- **Lockfile must be committed**: `package-lock.json` is tracked in the repo and is the authoritative artifact for deterministic installs on Vercel.
- **`node_modules` is never committed**: `.gitignore` explicitly ignores it, so contributors and CI must install from the lockfile.
- **Public npm registry only**: No `.npmrc`, no `NPM_TOKEN`, no private registry URL is configured anywhere in the repo; all packages resolve against `registry.npmjs.org`.
- **Semver ranges enforced by caret**: New dependencies should follow the existing pattern of using `^` ranges rather than exact versions or tilde ranges.
- **Type checking as a soft gate**: The `typecheck` script runs TypeScript against both `tsconfig.app.json` and `tsconfig.api.json`; mismatches between declared types and actual package versions will surface here.