import { useEffect, useState } from 'react';
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { apiPost } from '../lib/api/client.js';
import { BILLING_REFRESH_KEY } from '../lib/billingRefresh.js';

interface PaymentSuccessPageProps {
  onNavigate: (page: string) => void;
}

export default function PaymentSuccessPage({ onNavigate }: PaymentSuccessPageProps) {
  const [syncing, setSyncing] = useState(true);
  const [syncMessage, setSyncMessage] = useState('Activating your subscription…');

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 15;

    async function trySync() {
      while (!cancelled && attempts < maxAttempts) {
        attempts += 1;
        try {
          const result = await apiPost<{
            plan: string;
            subscription_status: string;
            is_pro: boolean;
          }>('/api/billing/sync', {});

          const isActive =
            result.plan?.toLowerCase() === 'pro' ||
            result.subscription_status?.toLowerCase() === 'active' ||
            result.subscription_status?.toLowerCase() === 'trialing' ||
            result.is_pro;

          if (isActive) {
            if (!cancelled) {
              setSyncMessage('Your Pro subscription is active.');
              setSyncing(false);
            }
            return;
          }
        } catch {
          // Webhook may still be processing — retry.
        }

        if (!cancelled) {
          setSyncMessage('Confirming payment with our billing system…');
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (!cancelled) {
        setSyncMessage(
          'Payment received. Your dashboard will update once billing sync completes — try Refresh on the Dashboard in a moment.',
        );
        setSyncing(false);
      }
    }

    void trySync();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="glass-card max-w-md w-full p-10 text-center paywall-overlay-animate">
        <div className="w-16 h-16 mx-auto neu-surface rounded-full flex items-center justify-center mb-6">
          {syncing ? (
            <Loader2 className="w-9 h-9 text-[#3c4a59] animate-spin" />
          ) : (
            <CheckCircle2 className="w-9 h-9 text-green-600" />
          )}
        </div>
        <h1 className="text-2xl font-extrabold text-primary mb-2">Payment Successful</h1>
        <p className="text-sm text-primary leading-relaxed mb-8">{syncMessage}</p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem(BILLING_REFRESH_KEY, '1');
              onNavigate('dashboard');
            }}
            className="btn-primary w-full"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => onNavigate('analyzer')} className="btn-ghost w-full">
            Analyze Another Resume
          </button>
        </div>
      </div>
    </div>
  );
}
