---
kind: business_term
name: Business Glossary
category: business_term
scope:
    - '**'
---

### Analysis Incomplete
- Definition：A report decision returned when the JD parser produces zero requirements (empty JD fast-path). The match score is forced to 0% and no matching/evidence is generated — distinct from a successful but low-scoring analysis.

### INVARIANT_FAILED
- Definition：An error thrown by `assertReportInvariants()` when the final analysis report violates internal consistency rules (e.g. classification contradictions, scoring bounds, denominator integrity, keyword count alignment). Used to catch regressions before reports reach the client.

### AiPipelineError
- Definition：The typed error class propagated through the analysis pipeline when an external dependency (JD parser, matcher, evaluator, bullet rewriter) fails. Carries a stable `code` (e.g. `MODEL_UNAVAILABLE`, `RATE_LIMITED`, `ANALYSIS_FAILED`) so callers can distinguish transient vs. permanent failures without inspecting messages.

### Provenance validation
- Definition：The step in JD parsing where each extracted requirement's `source_text` / `original_text` is verified to exist verbatim in the raw job description text. Requirements that cannot be located are dropped as hallucinated before matching proceeds.

### Evidence attribution validation
- Definition：Post-matching check that every piece of evidence cited for a requirement actually exists in the candidate's resume and belongs to the correct category (skill, experience, education, etc.). Invalidated evidence can downgrade a match to `ANALYSIS_FAILED`.

### Compound requirement downgrading
- Definition：When a JD requirement contains multiple sub-conditions joined by 'and', 'or', or commas, deterministic matching downgrades it to `PARTIAL_MATCH` so the LLM must evaluate each component individually rather than relying on lexical heuristics.

### Bullet rewrite grounding validation
- Definition：The post-generation check on LLM-generated resume bullet improvements that rejects invented metrics, unsupported named terms, unchanged before/after pairs, and negative improvements. Ensures suggested bullets are grounded in the original resume facts.

### Free launch mode
- Definition：Feature flag (`VITE_FREE_LAUNCH_MODE` / `FREE_LAUNCH_MODE`) that disables the paywall and makes every feature free during the product launch period. Must be flipped off before enabling Lemon Squeezy checkout.

### Board registry
- Definition：Configured JSON arrays (`GREENHOUSE_BOARD_REGISTRY`, `LEVER_BOARD_REGISTRY`, `ASHBY_BOARD_REGISTRY`, `PAKISTAN_PUBLIC_JOB_FEEDS`) that whitelist employer-specific job boards and public feeds for the Job Match feature, gated by country and industry tags.
- Aliases：Greenhouse board registry、Lever board registry、Ashby board registry、Pakistan public job feeds
