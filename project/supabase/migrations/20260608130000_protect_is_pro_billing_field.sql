-- Extend billing-field protection to profiles.is_pro.
-- Only service_role (webhooks / server) may change billing columns.

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
    NEW.is_pro := false;
    RETURN NEW;
  END IF;

  NEW.plan := OLD.plan;
  NEW.subscription_status := OLD.subscription_status;
  NEW.unlocked_reports := OLD.unlocked_reports;
  NEW.is_pro := OLD.is_pro;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND coalesce(plan, 'free') = 'free'
    AND coalesce(subscription_status, 'inactive') = 'inactive'
    AND coalesce(unlocked_reports, '[]'::jsonb) = '[]'::jsonb
    AND coalesce(is_pro, false) = false
  );
