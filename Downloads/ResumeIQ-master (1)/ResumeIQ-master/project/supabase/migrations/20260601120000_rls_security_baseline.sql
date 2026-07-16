-- ResuV security baseline: RLS, indexes, billing-field protection.
-- Apply via Supabase CLI: supabase db push (or run in SQL editor).
-- Review existing policies in Dashboard → Authentication → Policies before applying in production.

-- ── Ensure core tables exist (idempotent) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  subscription_status text NOT NULL DEFAULT 'inactive',
  unlocked_reports jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.resume_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ats_score integer NOT NULL DEFAULT 0,
  strengths text NOT NULL DEFAULT '',
  improvements text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.interview_prep (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_role text NOT NULL,
  hr_questions text NOT NULL DEFAULT '[]',
  technical_questions text NOT NULL DEFAULT '[]',
  behavioral_questions text NOT NULL DEFAULT '[]',
  star_tips text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_type text NOT NULL CHECK (feature_type IN ('resume_analysis', 'interview_prep'))
);

CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  review text NOT NULL
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS resume_analysis_user_created_idx
  ON public.resume_analysis (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS interview_prep_user_created_idx
  ON public.interview_prep (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS usage_tracking_user_feature_created_idx
  ON public.usage_tracking (user_id, feature_type, created_at DESC);

CREATE INDEX IF NOT EXISTS profiles_user_id_idx
  ON public.profiles (user_id);

-- ── Billing columns: only service role may change (via trigger) ─────────────

CREATE OR REPLACE FUNCTION public.protect_profile_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.jwt()->>'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.plan := 'free';
    NEW.subscription_status := 'inactive';
    NEW.unlocked_reports := '[]'::jsonb;
    RETURN NEW;
  END IF;

  NEW.plan := OLD.plan;
  NEW.subscription_status := OLD.subscription_status;
  NEW.unlocked_reports := OLD.unlocked_reports;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_billing_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_billing_fields_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_billing_fields();

-- ── Enable RLS ──────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_prep ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- purchase_events (if present from earlier migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_events'
  ) THEN
    EXECUTE 'ALTER TABLE public.purchase_events ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ── profiles ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND coalesce(plan, 'free') = 'free'
    AND coalesce(subscription_status, 'inactive') = 'inactive'
    AND coalesce(unlocked_reports, '[]'::jsonb) = '[]'::jsonb
  );

-- Users may update own row; billing fields are frozen by trigger above.
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── resume_analysis ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS resume_analysis_select_own ON public.resume_analysis;
CREATE POLICY resume_analysis_select_own ON public.resume_analysis
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS resume_analysis_insert_own ON public.resume_analysis;
CREATE POLICY resume_analysis_insert_own ON public.resume_analysis
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ── interview_prep ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS interview_prep_select_own ON public.interview_prep;
CREATE POLICY interview_prep_select_own ON public.interview_prep
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS interview_prep_insert_own ON public.interview_prep;
CREATE POLICY interview_prep_insert_own ON public.interview_prep
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ── usage_tracking ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS usage_tracking_select_own ON public.usage_tracking;
CREATE POLICY usage_tracking_select_own ON public.usage_tracking
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Inserts via service role only (API routes). No client INSERT policy.

-- ── testimonials: no client policies (insert via /api/submit-testimonial only) ─
-- RLS enabled with zero policies = deny all for anon/authenticated; service_role bypasses RLS.

-- ── purchase_events (read own only; writes via service role / webhooks) ─────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_events'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS purchase_events_select_own ON public.purchase_events';
    EXECUTE '
      CREATE POLICY purchase_events_select_own ON public.purchase_events
        FOR SELECT TO authenticated
        USING (auth.uid() = user_id)
    ';
  END IF;
END $$;
