import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  deriveIsPro,
  fetchBillingStatus,
  type BillingStatus,
} from '../lib/billingStatus.js';

type BillingContextValue = {
  billing: BillingStatus | null;
  isPro: boolean;
  plan: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const BillingContext = createContext<BillingContextValue | null>(null);

export function BillingProvider({
  session,
  children,
}: {
  session: Session | null;
  children: ReactNode;
}) {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(session));

  const refresh = useCallback(async () => {
    if (!session) {
      setBilling(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const status = await fetchBillingStatus();
      setBilling(status);
    } catch (err) {
      console.error('[billing] Failed to load billing status', err);
      setBilling(null);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<BillingContextValue>(() => {
    const plan = (billing?.plan || 'free').toLowerCase();
    const subscriptionStatus = billing?.subscription_status || 'inactive';
    const subscriptionExpiresAt = billing?.subscription_expires_at ?? null;
    const isPro = billing
      ? deriveIsPro(
          billing.plan,
          billing.subscription_status,
          billing.is_pro,
          billing.subscription_expires_at,
        )
      : false;

    return {
      billing,
      isPro,
      plan,
      subscriptionStatus,
      subscriptionExpiresAt,
      loading,
      refresh,
    };
  }, [billing, loading, refresh]);

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling(): BillingContextValue {
  const context = useContext(BillingContext);
  if (!context) {
    throw new Error('useBilling must be used within BillingProvider');
  }
  return context;
}
