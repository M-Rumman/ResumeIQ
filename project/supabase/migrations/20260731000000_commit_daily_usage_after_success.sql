-- Commit free usage only after the AI route has a complete successful result.
CREATE OR REPLACE FUNCTION public.complete_free_ai_usage(
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
  INSERT INTO public.profiles (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.profiles
  SET resume_analysis_count_today = CASE WHEN last_usage_reset_date IS DISTINCT FROM v_today THEN 0 ELSE resume_analysis_count_today END,
      interview_prep_count_today = CASE WHEN last_usage_reset_date IS DISTINCT FROM v_today THEN 0 ELSE interview_prep_count_today END,
      last_usage_reset_date = v_today
  WHERE user_id = p_user_id;
  SELECT CASE WHEN p_feature_type = 'resume_analysis' THEN resume_analysis_count_today ELSE interview_prep_count_today END
  INTO v_used FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;
  IF v_used >= v_limit THEN
    RETURN QUERY SELECT false, v_used, v_limit, v_today;
    RETURN;
  END IF;
  UPDATE public.profiles
  SET resume_analysis_count_today = resume_analysis_count_today + CASE WHEN p_feature_type = 'resume_analysis' THEN 1 ELSE 0 END,
      interview_prep_count_today = interview_prep_count_today + CASE WHEN p_feature_type = 'interview_prep' THEN 1 ELSE 0 END
  WHERE user_id = p_user_id
  RETURNING CASE WHEN p_feature_type = 'resume_analysis' THEN resume_analysis_count_today ELSE interview_prep_count_today END INTO v_used;
  RETURN QUERY SELECT true, v_used, v_limit, v_today;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_free_ai_usage(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_free_ai_usage(uuid, text) TO service_role;
