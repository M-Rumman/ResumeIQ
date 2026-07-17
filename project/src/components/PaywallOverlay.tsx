import { useState } from 'react';
import { Lock, Sparkles, Loader2 } from 'lucide-react';
import LogoMark from './LogoMark';
import {
  ONE_TIME_UNLOCK,
  PRO_SUBSCRIPTION,
  PAYWALL_COPY,
} from '../lib/monetizationConfig.js';

interface PaywallOverlayProps {
  onUnlockReport: () => Promise<void>;
  onSubscribePro: () => Promise<void>;
  onDismissPreview: () => void;
  limitMessage: string;
  processing?: boolean;
  paymentsEnabled?: boolean;
}

export default function PaywallOverlay({
  onUnlockReport,
  onSubscribePro,
  onDismissPreview,
  limitMessage,
  processing = false,
  paymentsEnabled = true,
}: PaywallOverlayProps) {
  const [localLoading, setLocalLoading] = useState<'unlock' | 'pro' | null>(null);

  async function handleUnlock() {
    setLocalLoading('unlock');
    try {
      await onUnlockReport();
    } finally {
      setLocalLoading(null);
    }
  }

  async function handlePro() {
    setLocalLoading('pro');
    try {
      await onSubscribePro();
    } finally {
      setLocalLoading(null);
    }
  }

  const busy = processing || localLoading !== null;
  const checkoutDisabled = !paymentsEnabled || busy;

  return (
    <div className="paywall-overlay paywall-overlay-animate" role="dialog" aria-labelledby="paywall-headline">
      <div className="paywall-overlay-card glass-card">
        <div className="flex justify-center mb-4">
          <LogoMark className="w-11 h-11 rounded-xl" />
        </div>
        <h3 id="paywall-headline" className="text-xl font-extrabold text-primary text-center">
          {limitMessage}
        </h3>
        <p className="mt-2 mb-6 text-sm text-primary text-center">
          Unlock this report or upgrade for unlimited access.
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={checkoutDisabled}
            onClick={paymentsEnabled ? handleUnlock : undefined}
            className="btn-primary w-full justify-center disabled:opacity-60"
          >
            {localLoading === 'unlock' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            {paymentsEnabled
              ? `${PAYWALL_COPY.unlockButton} — ${ONE_TIME_UNLOCK.priceDisplay}`
              : 'Launching Soon'}
          </button>

          <button
            type="button"
            disabled={checkoutDisabled}
            onClick={paymentsEnabled ? handlePro : undefined}
            className="btn-ghost w-full justify-center border border-[rgba(255,255,255,0.5)] disabled:opacity-60"
          >
            {localLoading === 'pro' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {paymentsEnabled
              ? `${PAYWALL_COPY.upgradeButton} — ${PRO_SUBSCRIPTION.priceDisplay}${PRO_SUBSCRIPTION.period}`
              : 'Launching Soon'}
          </button>
        </div>

        <p className="text-[11px] text-body text-center mt-4 leading-snug">
          {PRO_SUBSCRIPTION.trustLine}
        </p>

        <button
          type="button"
          onClick={onDismissPreview}
          disabled={busy}
          className="w-full mt-4 text-xs text-body hover:text-primary font-semibold transition-colors disabled:opacity-50"
        >
          {PAYWALL_COPY.dismiss}
        </button>
      </div>
    </div>
  );
}
