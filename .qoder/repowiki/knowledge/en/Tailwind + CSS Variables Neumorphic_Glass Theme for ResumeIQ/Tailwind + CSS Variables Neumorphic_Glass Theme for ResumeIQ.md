---
kind: frontend_style
name: Tailwind + CSS Variables Neumorphic/Glass Theme for ResumeIQ
category: frontend_style
scope:
    - '**'
source_files:
    - project/tailwind.config.js
    - project/postcss.config.js
    - project/src/index.css
    - project/src/styles/theme.css
    - project/src/style/theme.css
    - project/src/components/Navbar.tsx
    - project/src/components/HeroResumeMockup.tsx
    - project/src/components/BetaBanner.tsx
    - project/src/components/Footer.tsx
---

## What system/approach is used

The frontend styling of ResumeIQ is built on **Tailwind CSS** (v4-style `@tailwind` directives) with a custom design token layer defined as CSS custom properties in a dedicated theme stylesheet. The visual identity is a **neumorphic / glassmorphism** aesthetic: soft double shadows (`--shadow-dark`, `--shadow-light`) create raised and pressed surfaces, while translucent panels use `backdrop-filter: blur()` with white borders to simulate frosted glass. Typography is split into two families — Montserrat for display headings and Overlock for body/interactive text — both extended via Tailwind's `fontFamily` config.

## Key files and packages

- `project/tailwind.config.js` — Extends Tailwind with the project’s color palette (`base`, `accent`, `cta`, `btn-primary`, `ink.{DEFAULT,secondary,muted}`), font families (`display`, `body`), and semantic border radii (`neu`, `glass`, `modal`).
- `project/postcss.config.js` — Chains `tailwindcss` then `autoprefixer`.
- `project/src/index.css` — Entry point that imports the theme, then emits Tailwind base/components/utilities layers; also sets `#root { min-height: 100vh }`.
- `project/src/styles/theme.css` — The single source of truth for all design tokens and shared UI primitives: CSS variables under `:root`, global `body` styles, reusable component classes (`.neu-surface`, `.neu-pressed`, `.glass-card`, `.glass-panel`, `.glass-modal`, `.btn-primary`, `.btn-ghost`, `.input-neu`, `.nav-link`, `.section-label`, `.skill-tag`, `.beta-banner`, paywall overlay classes, scroll-reveal animations, reduced-motion overrides).
- `project/src/style/theme.css` — A minimal duplicate of the `:root` variables only (used elsewhere in the codebase for raw variable access).
- Component files such as `src/components/Navbar.tsx`, `HeroResumeMockup.tsx`, `BetaBanner.tsx`, `Footer.tsx` demonstrate how Tailwind utility classes are composed with the shared theme classes.

## Architecture and conventions

1. **Token-first approach**: All colors, radii, easing curves, and shadow values live in `:root` CSS variables. Components never hard-code hex values directly — they reference `var(--accent)`, `var(--radius-lg)`, etc., so changing the palette requires editing one place.
2. **Two-layer typography**: Headings and display text use the `Montserrat` family (via Tailwind `font-display`); body copy and interactive elements use `Overlock` serif (via `font-body`). This distinction is enforced globally in `theme.css`.
3. **Reusable surface primitives**: Instead of per-component styling, shared shapes are expressed as classes:
   - Raised surfaces: `.neu-surface`
   - Pressed/inset surfaces: `.neu-pressed`
   - Frosted panels: `.glass-card`, `.glass-card-solid`, `.glass-card-interactive`, `.glass-panel`, `.glass-nav`, `.glass-modal`
   - Buttons: `.btn-primary` (with optional `.btn-cta` modifier), `.btn-ghost`
   - Inputs: `.input-neu`
   - Labels/tags: `.section-label`, `.skill-tag`
   - Paywall UI: `.paywall-gate`, `.paywall-content`, `.paywall-locked-region`, `.paywall-frost`, `.paywall-overlay`, `.paywall-pricing-card`
4. **Animation & motion**: Scroll-triggered reveal uses the `.scroll-reveal` class toggled by JS; keyframes `score-ring-fill`, `float-card`, and `paywall-fade-in` are centralized. A `prefers-reduced-motion` block disables all animations/transitions when the user prefers reduced motion.
5. **Responsive strategy**: No media-query breakpoints are defined in the theme itself; responsiveness is achieved entirely through Tailwind utility classes (e.g., `sm:text-4xl`, `lg:hidden`, `max-w-7xl mx-auto`).
6. **Paywall visual treatment**: Locked content is wrapped in `.paywall-gate` with a `.paywall-frost` gradient overlay and a centered pricing card, using the same neumorphic/glass vocabulary.

## Conventions and constraints

- **Do not inline brand colors or radii in components** — always use the Tailwind extended tokens (`text-ink`, `bg-accent`, `rounded-[var(--radius-md)]`) or the shared class names from `theme.css`. The grep results show consistent usage of these across Navbar, HeroResumeMockup, BetaBanner, Footer, and other components.
- **Typography must follow the display/body split**: headings and logos use `font-display`; body copy and buttons use `font-body` (enforced by the global selectors in `theme.css`).
- **Interactive surfaces should use the provided primitives** (`.neu-surface`, `.neu-pressed`, `.glass-card`, `.btn-primary`, `.btn-ghost`, `.input-neu`) rather than ad-hoc box-shadow declarations, ensuring consistent neumorphic depth.
- **Animations must respect reduced motion**: any new animation should be guarded by `@media (prefers-reduced-motion: reduce)` following the pattern already present in `theme.css`.
- **Paywall regions must use the established `.paywall-*` class set** so the frost overlay and pricing card render consistently across pages.
- **Theme changes flow through `src/styles/theme.css`** (variables + shared classes) and `tailwind.config.js` (extended tokens); there is no separate design-system package.