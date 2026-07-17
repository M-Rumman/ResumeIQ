-- Preserve subscription_expires_at when a billing write passes NULL (e.g. invoice webhooks
-- without renews_at). Matches COALESCE behavior used for Lemon IDs.

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
    subscription_expires_at = COALESCE(EXCLUDED.subscription_expires_at, profiles.subscription_expires_at),
    unlocked_reports = CASE
      WHEN p_unlocked_reports IS NOT NULL THEN EXCLUDED.unlocked_reports
      ELSE profiles.unlocked_reports
    END;
END;
$$;
