import { useCallback, useEffect, useState } from 'react';
import { PAYMENTS_ENABLED } from '../lib/paymentsConfig.js';
import { apiPost } from '../lib/api/client.js';

const PENDING_CHECKOUT_KEY = 'resuv_pending_checkout';

type PendingCheckout = {
  mode: 'unlock' | 'subscription';
  reportId?: string;
};

interface UsePaywallCheckoutOptions {
  userId: string | null;
  reportId: string | null;
  onRequireAuth?: () => void;
}

function readPendingCheckout(): PendingCheckout | null {
  const raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingCheckout;
    if (parsed.mode !== 'unlock' && parsed.mode !== 'subscription') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function usePaywallCheckout({
  userId,
  reportId,
  onRequireAuth,
}: UsePaywallCheckoutOptions) {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const runCheckout = useCallback(
    async (mode: 'unlock' | 'subscription') => {
      if (!PAYMENTS_ENABLED) return;

      setError(null);
      if (!userId) {
        const pending: PendingCheckout = {
          mode,
          reportId: mode === 'unlock' ? reportId ?? undefined : undefined,
        };
        sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(pending));
        onRequireAuth?.();
        setError('Sign in to continue.');
        return;
      }
      if (mode === 'unlock' && !reportId) {
        setError('No report to unlock.');
        return;
      }

      setProcessing(true);
      try {
        const { checkoutUrl } = await apiPost<{ checkoutUrl: string }>('/api/create-checkout', {
          mode: mode === 'unlock' ? 'unlock' : 'subscription',
          reportId: mode === 'unlock' ? reportId : undefined,
        });
        window.location.href = checkoutUrl;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
        setProcessing(false);
      }
    },
    [userId, reportId, onRequireAuth],
  );

  useEffect(() => {
    if (!PAYMENTS_ENABLED || !userId) return;

    const pending = readPendingCheckout();
    if (!pending) return;

    if (pending.mode === 'unlock') {
      if (!reportId || pending.reportId !== reportId) return;
    }

    sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
    void runCheckout(pending.mode);
  }, [userId, reportId, runCheckout]);

  return {
    unlockReport: () => runCheckout('unlock'),
    subscribePro: () => runCheckout('subscription'),
    error,
    setError,
    processing,
    placeholderMode: false,
    paymentsEnabled: PAYMENTS_ENABLED,
  };
}
