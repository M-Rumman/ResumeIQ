import { Lock, Sparkles } from 'lucide-react';
import {
  ONE_TIME_UNLOCK,
  PRO_SUBSCRIPTION,
} from '../lib/monetizationConfig.js';

interface PaywallCheckoutPreviewProps {
  onPricingSoon: () => void;
}

/** Shows future pricing during the launch offer without any checkout action. */
export default function PaywallCheckoutPreview({ onPricingSoon }: PaywallCheckoutPreviewProps) {
  return (
    <div className="glass-card-solid p-6 sm:p-8" aria-labelledby="checkout-preview-heading">
      <h3 id="checkout-preview-heading" className="mb-2 text-center text-lg font-extrabold text-primary">
        Everything is included
      </h3>
      <p className="mx-auto mb-6 max-w-lg text-center text-sm text-primary">
        This report is included in the launch offer. Planned pricing is shown below; no payment is required today.
      </p>
      <div className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
        <button type="button" disabled className="btn-primary w-full justify-center cursor-not-allowed opacity-70" title="Included in the launch offer">
          <Sparkles className="h-4 w-4" />
          Currently Free — Pro {PRO_SUBSCRIPTION.priceDisplay}{PRO_SUBSCRIPTION.period}
        </button>
        <button type="button" disabled className="btn-ghost w-full justify-center cursor-not-allowed border border-[rgba(255,255,255,0.5)] opacity-70" title="Included in the launch offer">
          <Lock className="h-4 w-4" />
          Included in Launch Offer — {ONE_TIME_UNLOCK.priceDisplay}
        </button>
      </div>
      <button type="button" onClick={onPricingSoon} className="mt-4 w-full text-sm font-bold text-[#3c4a59] hover:underline">
        View pricing details
      </button>
    </div>
  );
}
