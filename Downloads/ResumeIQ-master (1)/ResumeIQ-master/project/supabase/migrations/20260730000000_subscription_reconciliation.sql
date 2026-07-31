-- Lemon Squeezy is the source of truth for subscription state. These fields
-- track the most recent authoritative reconciliation independently of webhooks.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.profiles.cancelled_at IS
  'Cancellation timestamp reported by Lemon Squeezy during webhook or API reconciliation.';
COMMENT ON COLUMN public.profiles.last_sync IS
  'Timestamp of the last successful authoritative Lemon Squeezy subscription reconciliation.';

-- Keep reconciliation metadata server-controlled just like plan/status/expiry.
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
    NEW.cancelled_at := NULL;
    NEW.last_sync := NULL;
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
  NEW.cancelled_at := OLD.cancelled_at;
  NEW.last_sync := OLD.last_sync;
  NEW.resume_analysis_count_today := OLD.resume_analysis_count_today;
  NEW.interview_prep_count_today := OLD.interview_prep_count_today;
  NEW.last_usage_reset_date := OLD.last_usage_reset_date;
  RETURN NEW;
END;
$$;
