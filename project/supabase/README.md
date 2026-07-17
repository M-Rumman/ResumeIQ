# Supabase migrations

Apply security migrations before marketing launch:

```bash
cd project
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or paste SQL from `supabase/migrations/` into **Supabase Dashboard → SQL Editor** in order:

1. `20260601120000_rls_security_baseline.sql` — RLS policies, indexes, billing trigger
2. `20260601120001_remove_paddle_artifacts.sql` — drops Paddle columns/tables
3. `20260601120003_harden_rls_policies.sql` — removes legacy duplicate policies, locks testimonials, hardens billing trigger
4. `20260608120000_lemon_squeezy_billing.sql` — Lemon customer/subscription columns (`lemonsqueezy_*` on profiles) + purchase_events audit log
5. `20260608130000_protect_is_pro_billing_field.sql` — extends billing trigger to protect `is_pro`
6. `20260616120000_protect_subscription_expires_at.sql` — protects `subscription_expires_at`
7. `20260617140000_align_profile_lemon_column_names.sql` — renames legacy `lemon_*` profile columns to `lemonsqueezy_*` if needed

After applying, verify in **Authentication → Policies** that each table has the expected policies and test with a non-owner account.
