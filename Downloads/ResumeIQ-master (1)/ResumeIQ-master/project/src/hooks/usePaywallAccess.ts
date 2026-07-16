import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { getPaywallProfile, hasFullReportAccess } from '../lib/paywallAccess.js';

type PaywallProfile = Awaited<ReturnType<typeof getPaywallProfile>>;

export function usePaywallAccess(reportId: string | null) {
  const [profile, setProfile] = useState<PaywallProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUserId(null);
      setProfile({
        plan: 'free',
        isPro: false,
        subscriptionStatus: 'inactive',
        unlockedReports: [],
        freeTrialReportIds: [],
        error: null,
      });
      setLoading(false);
      return;
    }

    setUserId(user.id);
    const next = await getPaywallProfile(user.id);
    setProfile(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, reportId]);

  const unlocked =
    profile !== null && hasFullReportAccess(profile, reportId);

  return {
    profile,
    loading,
    userId,
    unlocked,
    isPro: profile?.isPro ?? false,
    refresh,
  };
}
