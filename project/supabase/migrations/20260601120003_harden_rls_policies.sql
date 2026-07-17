-- Harden RLS: remove legacy duplicate policies, lock down testimonials,
-- protect billing fields on INSERT, revoke public EXECUTE on SECURITY DEFINER functions.

-- ── Drop legacy policies (weaker duplicates that OR-bypass stricter rules) ───

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can select own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can insert own resume analysis" ON public.resume_analysis;
DROP POLICY IF EXISTS "Users can select own resume analysis" ON public.resume_analysis;

DROP POLICY IF EXISTS "Users can insert own interview prep" ON public.interview_prep;
DROP POLICY IF EXISTS "Users can select own interview prep" ON public.interview_prep;

DROP POLICY IF EXISTS "Users can insert own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "Users can select own usage" ON public.usage_tracking;

-- Testimonials: server-only writes via /api/submit-testimonial (service role).
-- Remove all client policies including wide-open legacy rules.
DROP POLICY IF EXISTS "Allow anyone to insert testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Allow anyone to read testimonials" ON public.testimonials;
DROP POLICY IF EXISTS testimonials_insert_public ON public.testimonials;

-- usage_tracking writes: service role only (API routes record usage).
DROP POLICY IF EXISTS usage_tracking_insert_own ON public.usage_tracking;

-- ── Billing fields: enforce on INSERT and UPDATE (not just UPDATE) ───────────

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

-- ── Revoke RPC access to internal SECURITY DEFINER functions ────────────────

REVOKE ALL ON FUNCTION public.protect_profile_billing_fields() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.protect_profile_billing_fields() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
