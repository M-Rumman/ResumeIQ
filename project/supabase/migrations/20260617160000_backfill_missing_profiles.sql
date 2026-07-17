-- Backfill profiles for auth users missing a row (fixes silent webhook UPDATE 0-row issue).
INSERT INTO public.profiles (user_id, plan, subscription_status, unlocked_reports, is_pro)
SELECT
  u.id,
  'free',
  'inactive',
  '[]'::jsonb,
  false
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;
