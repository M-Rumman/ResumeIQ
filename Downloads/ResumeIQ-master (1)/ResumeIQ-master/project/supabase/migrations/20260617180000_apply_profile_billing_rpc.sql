-- Reliable server-side billing writes: bypass protect_profile_billing_fields via session flag.
-- Only callable by service_role (webhooks / API).

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
    RETURN NEW;
  END IF;

  NEW.plan := OLD.plan;
  NEW.subscription_status := OLD.subscription_status;
  NEW.unlocked_reports := OLD.unlocked_reports;
  NEW.is_pro := OLD.is_pro;
  NEW.subscription_expires_at := OLD.subscription_expires_at;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_profile_billing(
  p_user_id uuid,
  p_plan text,
  p_subscription_status text,
  p_is_pro boolean,
  p_customer_id text DEFAULT NULL,
  p_subscription_id text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_unlocked_reports jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unlocked jsonb;
BEGIN
  PERFORM set_config('app.billing_write', 'true', true);

  SELECT coalesce(p_unlocked_reports, p.unlocked_reports, '[]'::jsonb)
  INTO v_unlocked
  FROM public.profiles p
  WHERE p.user_id = p_user_id;

  IF NOT FOUND THEN
    v_unlocked := coalesce(p_unlocked_reports, '[]'::jsonb);
  END IF;

  INSERT INTO public.profiles (
    user_id,
    plan,
    subscription_status,
    is_pro,
    lemonsqueezy_customer_id,
    lemonsqueezy_subscription_id,
    subscription_expires_at,
    unlocked_reports
  ) VALUES (
    p_user_id,
    p_plan,
    p_subscription_status,
    p_is_pro,
    p_customer_id,
    p_subscription_id,
    p_expires_at,
    v_unlocked
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan = EXCLUDED.plan,
    subscription_status = EXCLUDED.subscription_status,
    is_pro = EXCLUDED.is_pro,
    lemonsqueezy_customer_id = COALESCE(EXCLUDED.lemonsqueezy_customer_id, profiles.lemonsqueezy_customer_id),
    lemonsqueezy_subscription_id = COALESCE(EXCLUDED.lemonsqueezy_subscription_id, profiles.lemonsqueezy_subscription_id),
    subscription_expires_at = EXCLUDED.subscription_expires_at,
    unlocked_reports = CASE
      WHEN p_unlocked_reports IS NOT NULL THEN EXCLUDED.unlocked_reports
      ELSE profiles.unlocked_reports
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_profile_billing(
  uuid, text, text, boolean, text, text, timestamptz, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.apply_profile_billing(
  uuid, text, text, boolean, text, text, timestamptz, jsonb
) TO service_role;
