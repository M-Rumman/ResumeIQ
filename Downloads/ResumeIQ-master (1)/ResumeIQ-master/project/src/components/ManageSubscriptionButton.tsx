import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { fetchManageSubscriptionUrl } from '../lib/manageSubscription.js';

interface ManageSubscriptionButtonProps {
  className?: string;
  variant?: 'primary' | 'ghost';
  label?: string;
}

export default function ManageSubscriptionButton({
  className = '',
  variant = 'ghost',
  label = 'Manage Subscription',
}: ManageSubscriptionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const url = await fetchManageSubscriptionUrl();
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the billing portal. Please try again.');
      setLoading(false);
    }
  }

  const baseClass = variant === 'primary'
    ? 'btn-primary btn-cta w-full'
    : 'inline-flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors shadow-sm w-full';

  return (
    <div className={className}>
      <button type="button" onClick={() => void handleClick()} disabled={loading} className={`${baseClass} disabled:cursor-not-allowed disabled:opacity-60`}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
        {loading ? 'Opening billing portal...' : label}
      </button>
      {error && <p className="mt-2 text-center text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
