import { useEffect } from 'react';
import { CreditCard, BadgeCheck } from 'lucide-react';
import ManageSubscriptionButton from './ManageSubscriptionButton';
import { useBilling } from '../context/BillingContext.js';
import { PAYMENTS_ENABLED } from '../lib/paymentsConfig.js';
import { formatSubscriptionExpiry } from '../lib/formatSubscriptionExpiry.js';

interface UserSubscriptionSummaryProps {
  refreshKey?: number;
}

function formatDisplayValue(value: string | null) {
  if (!value) return 'Not set';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function planBadgeStyles(plan: string | null) {
  const normalized = plan?.toLowerCase() ?? '';
  if (normalized === 'free') return 'text-gray-700 bg-gray-50 border-gray-200';
  return 'text-[#3c4a59] bg-gray-50 border-gray-200';
}

function statusBadgeStyles(status: string | null) {
  const normalized = status?.toLowerCase() ?? '';
  if (normalized === 'active') return 'text-green-700 bg-green-50 border-green-100';
  return 'text-gray-600 bg-gray-50 border-gray-200';
}

export default function UserSubscriptionSummary({ refreshKey = 0 }: UserSubscriptionSummaryProps) {
  const {
    billing,
    isPro,
    plan,
    subscriptionStatus,
    subscriptionExpiresAt,
    loading,
    refresh,
  } = useBilling();

  useEffect(() => {
    if (refreshKey > 0) {
      void refresh();
    }
  }, [refreshKey, refresh]);

  const error = billing === null && !loading ? 'Could not load your subscription details.' : null;

  const cancelledGrace =
    subscriptionStatus?.toLowerCase() === 'cancelled' &&
    subscriptionExpiresAt !== null &&
    new Date(subscriptionExpiresAt).getTime() > Date.now();
  const expiryLabel = cancelledGrace ? formatSubscriptionExpiry(subscriptionExpiresAt) : null;
  const showManageSubscription = isPro && PAYMENTS_ENABLED;

  return (
    <div className="space-y-4">
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="glass-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-4 h-4 text-[#3c4a59]" />
          <h3 className="text-sm font-bold text-gray-900">Current Plan</h3>
        </div>
        {loading ? (
          <div className="h-8 w-24 bg-gray-100 rounded-lg animate-pulse" />
        ) : error ? (
          <p className="text-sm text-red-600 font-medium">{error}</p>
        ) : (
          <span
            className={`inline-flex items-center px-3 py-1.5 rounded-full border text-sm font-bold ${planBadgeStyles(plan)}`}
          >
            {formatDisplayValue(plan)}
          </span>
        )}
      </div>

      <div className="glass-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <BadgeCheck className="w-4 h-4 text-[#3c4a59]" />
          <h3 className="text-sm font-bold text-gray-900">Subscription Status</h3>
        </div>
        {loading ? (
          <div className="h-8 w-28 bg-gray-100 rounded-lg animate-pulse" />
        ) : error ? (
          <p className="text-sm text-red-600 font-medium">{error}</p>
        ) : (
          <span
            className={`inline-flex items-center px-3 py-1.5 rounded-full border text-sm font-bold ${statusBadgeStyles(subscriptionStatus)}`}
          >
            {formatDisplayValue(subscriptionStatus)}
          </span>
        )}
      </div>
    </div>
    {isPro && !loading && !error && (
      <div className="space-y-4">
        <div className="glass-card px-5 py-4 flex items-center gap-3">
          <BadgeCheck className="w-5 h-5 text-[#3c4a59] flex-shrink-0" />
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-900">Priority access:</span> Pro members get early access to new ResuV features.
          </p>
        </div>
        {expiryLabel && (
          <p className="text-sm text-gray-700 px-1">
            Pro access until <span className="font-semibold text-gray-900">{expiryLabel}</span>.
          </p>
        )}
        {showManageSubscription && <ManageSubscriptionButton />}
      </div>
    )}
    </div>
  );
}
