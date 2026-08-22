---
kind: external_dependency
name: Lemon Squeezy (checkout + subscription webhooks)
slug: lemon-squeezy
category: external_dependency
category_hints:
    - vendor_identity
    - auth_protocol
scope:
    - '**'
source_files:
    - project/.env.example
    - project/api/_lib/lemonSqueezy.ts
    - project/api/_lib/payments.ts
    - project/api/lemonsqueezy/webhook.ts
    - project/api/create-checkout.ts
    - project/api/manage-subscription.ts
---

### Role
- Payments provider for ResuV's paid plans. Handles checkout session creation, subscription management, and webhook-driven billing state reconciliation into Supabase `profiles.lemonsqueezy_*` columns.
- Feature flag: `PAYMENTS_ENABLED` / `VITE_PAYMENTS_ENABLED` gate the checkout flow; when disabled the app runs in public beta mode.

### Integration points
- Checkout: `project/api/create-checkout.ts` reads `LEMON_API_KEY` and variant IDs (`VITE_LEMON_UNLOCK_VARIANT_ID`, `VITE_LEMON_PRO_VARIANT_ID`) to create sessions.
- Webhook: `project/api/lemonsqueezy/webhook.ts` verifies signatures using `LEMON_WEBHOOK_SECRET` and updates subscription expiry / pro status.
- Subscription management: `project/api/manage-subscription.ts` opens customer portal links.
- Rate limiting & billing checks: `billingRateLimit.ts`, `billing.ts`, `billingSchema.ts`, `dailyUsage.ts` enforce per-user limits based on subscription state.

### Durable notes
- Webhook endpoint is `https://YOUR-DOMAIN/api/lemonsqueezy/webhook` — must be registered in Lemon Squeezy dashboard.
- Migration history shows a full switch from Paddle to Lemon Squeezy; do not reference any `paddle_*` columns or tables.