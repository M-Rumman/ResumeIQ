-- Unique email enforcement on public.profiles (auth.users is owned by Supabase Auth
-- and cannot be altered from the SQL editor). Supabase Auth already rejects duplicate
-- signups; this adds a database constraint we control on the profiles table.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN public.profiles.email IS
  'Lowercase email set at signup. Unique per account; display names are not unique.';

-- Backfill existing profiles from auth.users (read-only; no auth schema ownership needed).
UPDATE public.profiles p
SET email = lower(trim(u.email))
FROM auth.users u
WHERE p.user_id = u.id
  AND u.email IS NOT NULL
  AND (p.email IS NULL OR btrim(p.email) = '');

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_unique
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;

-- Keep email immutable after insert (only service_role / billing writes bypass trigger).
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

  RETURN NEW;
END;
$$;
