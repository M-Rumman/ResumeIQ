-- Daily free AI usage. Counters are reset lazily in UTC by the service-role
-- RPC whenever a user starts an AI request; no scheduled job is required.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS resume_analysis_count_today integer NOT NULL DEFAULT 0
    CHECK (resume_analysis_count_today >= 0),
  ADD COLUMN IF NOT EXISTS interview_prep_count_today integer NOT NULL DEFAULT 0
    CHECK (interview_prep_count_today >= 0),
  ADD COLUMN IF NOT EXISTS last_usage_reset_date date;

COMMENT ON COLUMN public.profiles.resume_analysis_count_today IS
  'Free resume-analysis requests for last_usage_reset_date (UTC).';
COMMENT ON COLUMN public.profiles.interview_prep_count_today IS
  'Free interview-prep requests for last_usage_reset_date (UTC).';
COMMENT ON COLUMN public.profiles.last_usage_reset_date IS
  'UTC date on which the daily free AI counters were last reset.';

-- Prevent authenticated clients from changing quota counters directly. The
-- service role (used by API routes) remains able to update them.
CREATE OR REPLACE FUNCTION public.protect_profile_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.jwt()->>'role', '') = 'service_role'
     OR coalesce(current_setting('app.billing_write', true), '') = 'true' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.plan := 'free';
    NEW.subscription_status := 'inactive';
    NEW.unlocked_reports := '[]'::jsonb;
    NEW.is_pro := false;
    NEW.subscription_expires_at := NULL;
    NEW.lemonsqueezy_customer_id := NULL;
    NEW.lemonsqueezy_subscription_id := NULL;
    NEW.resume_analysis_count_today := 0;
    NEW.interview_prep_count_today := 0;
    NEW.last_usage_reset_date := NULL;
    IF NEW.email IS NOT NULL THEN
      NEW.email := lower(trim(NEW.email));
    END IF;
    RETURN NEW;
  END IF;

  NEW.plan := OLD.plan;
  NEW.subscription_status := OLD.subscription_status;
  NEW.unlocked_reports := OLD.unlocked_reports;
  NEW.is_pro := OLD.is_pro;
  NEW.subscription_expires_at := OLD.subscription_expires_at;
  NEW.email := OLD.email;
  NEW.lemonsqueezy_customer_id := OLD.lemonsqueezy_customer_id;
  NEW.lemonsqueezy_subscription_id := OLD.lemonsqueezy_subscription_id;
  NEW.resume_analysis_count_today := OLD.resume_analysis_count_today;
  NEW.interview_prep_count_today := OLD.interview_prep_count_today;
  NEW.last_usage_reset_date := OLD.last_usage_reset_date;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_free_ai_usage(
  p_user_id uuid,
  p_feature_type text
)
RETURNS TABLE(allowed boolean, used integer, daily_limit integer, reset_date date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_limit constant integer := 2;
  v_used integer;
BEGIN
  IF p_feature_type NOT IN ('resume_analysis', 'interview_prep') THEN
    RAISE EXCEPTION 'Unsupported AI feature type: %', p_feature_type USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.profiles (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.profiles
  SET
    resume_analysis_count_today = CASE WHEN last_usage_reset_date IS DISTINCT FROM v_today THEN 0 ELSE resume_analysis_count_today END,
    interview_prep_count_today = CASE WHEN last_usage_reset_date IS DISTINCT FROM v_today THEN 0 ELSE interview_prep_count_today END,
    last_usage_reset_date = v_today
  WHERE user_id = p_user_id;

  SELECT CASE WHEN p_feature_type = 'resume_analysis' THEN resume_analysis_count_today ELSE interview_prep_count_today END
  INTO v_used
  FROM public.profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_used >= v_limit THEN
    RETURN QUERY SELECT false, v_used, v_limit, v_today;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET
    resume_analysis_count_today = resume_analysis_count_today + CASE WHEN p_feature_type = 'resume_analysis' THEN 1 ELSE 0 END,
    interview_prep_count_today = interview_prep_count_today + CASE WHEN p_feature_type = 'interview_prep' THEN 1 ELSE 0 END
  WHERE user_id = p_user_id
  RETURNING CASE WHEN p_feature_type = 'resume_analysis' THEN resume_analysis_count_today ELSE interview_prep_count_today END
  INTO v_used;

  RETURN QUERY SELECT true, v_used, v_limit, v_today;
END;
$$;

-- Failed AI requests release their reservation, so only completed requests use
-- a daily slot while concurrent calls cannot exceed the limit.
CREATE OR REPLACE FUNCTION public.release_free_ai_usage(
  p_user_id uuid,
  p_feature_type text,
  p_usage_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF p_feature_type NOT IN ('resume_analysis', 'interview_prep') THEN
    RAISE EXCEPTION 'Unsupported AI feature type: %', p_feature_type USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
  SET
    resume_analysis_count_today = CASE
      WHEN p_feature_type = 'resume_analysis' AND last_usage_reset_date = v_today AND last_usage_reset_date = p_usage_date THEN GREATEST(0, resume_analysis_count_today - 1)
      ELSE resume_analysis_count_today END,
    interview_prep_count_today = CASE
      WHEN p_feature_type = 'interview_prep' AND last_usage_reset_date = v_today AND last_usage_reset_date = p_usage_date THEN GREATEST(0, interview_prep_count_today - 1)
      ELSE interview_prep_count_today END
  WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_free_ai_usage(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_free_ai_usage(uuid, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_free_ai_usage(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_free_ai_usage(uuid, text, date) TO service_role;
