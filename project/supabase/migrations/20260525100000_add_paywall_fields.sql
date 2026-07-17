-- Paywall: per-report unlocks and subscription tracking on profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unlocked_reports jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.unlocked_reports IS
  'Array of report IDs unlocked via one-time purchase (e.g. resume_analysis:uuid)';

-- Ensure subscription_status has a sensible default for new rows
ALTER TABLE public.profiles
  ALTER COLUMN subscription_status SET DEFAULT 'inactive';

-- Backfill null unlocked_reports
UPDATE public.profiles
SET unlocked_reports = '[]'::jsonb
WHERE unlocked_reports IS NULL;
