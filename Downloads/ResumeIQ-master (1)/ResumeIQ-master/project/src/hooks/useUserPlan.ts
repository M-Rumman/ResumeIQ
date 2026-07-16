import { useEffect } from 'react';
import { useBilling } from '../context/BillingContext.js';

export function useUserPlan(refreshKey = 0) {
  const {
    isPro,
    plan,
    loading,
    subscriptionStatus,
    subscriptionExpiresAt,
    refresh,
  } = useBilling();

  useEffect(() => {
    if (refreshKey > 0) {
      void refresh();
    }
  }, [refreshKey, refresh]);

  return { isPro, plan, loading, subscriptionStatus, subscriptionExpiresAt };
}
