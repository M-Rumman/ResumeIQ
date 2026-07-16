-- Lemon Squeezy billing: profile metadata + idempotent webhook audit log.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id text;

COMMENT ON COLUMN public.profiles.lemonsqueezy_customer_id IS
  'Lemon Squeezy customer ID for the user.';
COMMENT ON COLUMN public.profiles.lemonsqueezy_subscription_id IS
  'Active Lemon Squeezy subscription ID (Pro plan).';

CREATE TABLE IF NOT EXISTS public.purchase_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lemon_event_key text NOT NULL UNIQUE,
  event_name text NOT NULL,
  purchase_type text CHECK (purchase_type IN ('unlock', 'subscription')),
  lemon_order_id text,
  lemon_subscription_id text,
  report_id text,
  amount_cents integer,
  currency text DEFAULT 'USD',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS purchase_events_user_id_idx ON public.purchase_events(user_id);
CREATE INDEX IF NOT EXISTS purchase_events_lemon_order_id_idx ON public.purchase_events(lemon_order_id);
CREATE INDEX IF NOT EXISTS purchase_events_lemon_subscription_id_idx
  ON public.purchase_events(lemon_subscription_id);

ALTER TABLE public.purchase_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_events_select_own ON public.purchase_events;
CREATE POLICY purchase_events_select_own ON public.purchase_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.purchase_events IS
  'Idempotent Lemon Squeezy webhook log; prevents duplicate entitlement processing.';
