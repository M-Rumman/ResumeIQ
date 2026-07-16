-- Protect Lemon Squeezy identifiers from client-side profile updates.
-- Only service_role / trusted billing writes may set these columns.

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

  RETURN NEW;
END;
$$;
