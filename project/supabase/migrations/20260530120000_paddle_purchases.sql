-- Payment audit trail + subscription metadata on profiles (legacy column names)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS paddle_customer_id text,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id text;

CREATE TABLE IF NOT EXISTS public.purchase_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_transaction_id text NOT NULL UNIQUE,
  report_id text,
  purchase_type text NOT NULL CHECK (purchase_type IN ('unlock', 'subscription')),
  amount_cents integer,
  currency text DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_events_user_id_idx ON public.purchase_events(user_id);
CREATE INDEX IF NOT EXISTS purchase_events_report_id_idx ON public.purchase_events(report_id);

ALTER TABLE public.purchase_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own purchase events"
  ON public.purchase_events FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.purchase_events IS
  'Idempotent payment log; prevents duplicate unlock processing.';
