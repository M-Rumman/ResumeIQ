import { Lock, Sparkles } from 'lucide-react';
import {
  ONE_TIME_UNLOCK,
  PRO_SUBSCRIPTION,
} from '../lib/monetizationConfig.js';

interface PaywallCheckoutPreviewProps {
  onPricingSoon: () => void;
}

/** Visible pricing CTAs during beta — buttons disabled until Lemon Squeezy checkout is live. */
export default function PaywallCheckoutPreview({ onPricingSoon }: PaywallCheckoutPreviewProps) {
  return (
    <div className="glass-card-solid p-6 sm:p-8" aria-labelledby="checkout-preview-heading">
      <h3 id="checkout-preview-heading" className="text-lg font-extrabold text-primary text-center mb-2">
        Unlock full results
      </h3>
      <p className="text-sm text-primary text-center mb-6 max-w-lg mx-auto">
        ResuV will become a paid product soon. During beta, all features remain free — preview planned pricing below.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
        <button
          type="button"
          disabled
          className="btn-primary w-full justify-center opacity-70 cursor-not-allowed"
          title="Available when payments launch"
        >
          <Sparkles className="w-4 h-4" />
          Launching Soon — Pro {PRO_SUBSCRIPTION.priceDisplay}
          {PRO_SUBSCRIPTION.period}
        </button>
        <button
          type="button"
          disabled
          className="btn-ghost w-full justify-center opacity-70 cursor-not-allowed border border-[rgba(255,255,255,0.5)]"
          title="Available when payments launch"
        >
          <Lock className="w-4 h-4" />
          Launching Soon — Unlock {ONE_TIME_UNLOCK.priceDisplay}
        </button>
      </div>
      <button
        type="button"
        onClick={onPricingSoon}
        className="w-full mt-4 text-sm text-[#3c4a59] font-bold hover:underline"
      >
        View pricing details
      </button>
    </div>
  );
}
