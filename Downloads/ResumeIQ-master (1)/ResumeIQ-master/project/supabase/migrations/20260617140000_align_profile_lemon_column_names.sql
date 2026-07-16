-- Align profiles Lemon column names with production canonical names (lemonsqueezy_*).
-- Safe for databases that already have lemonsqueezy_* or legacy lemon_* columns.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'lemon_customer_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'lemonsqueezy_customer_id'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN lemon_customer_id TO lemonsqueezy_customer_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'lemon_subscription_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'lemonsqueezy_subscription_id'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN lemon_subscription_id TO lemonsqueezy_subscription_id;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id text;

COMMENT ON COLUMN public.profiles.lemonsqueezy_customer_id IS
  'Lemon Squeezy customer ID for the user.';
COMMENT ON COLUMN public.profiles.lemonsqueezy_subscription_id IS
  'Active Lemon Squeezy subscription ID (Pro plan).';
