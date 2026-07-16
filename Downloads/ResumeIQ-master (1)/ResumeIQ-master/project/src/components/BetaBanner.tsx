import { Sparkles } from 'lucide-react';
import { ONE_TIME_UNLOCK, PRO_SUBSCRIPTION } from '../lib/monetizationConfig.js';

interface BetaBannerProps {
  onPricingSoon: () => void;
}

export default function BetaBanner({ onPricingSoon }: BetaBannerProps) {
  return (
    <div
      className="beta-banner"
      role="status"
      aria-label="ResuV public beta"
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 neu-surface rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-[#3c4a59]" />
          </div>
          <div className="space-y-2 text-sm leading-relaxed">
            <p className="font-bold text-primary text-base">
              ResuV is free to use during our public beta.
            </p>
            <p className="text-primary">
              Paid plans are coming soon — until then, enjoy full access to resume analysis, interview prep, and all recommendations at no cost.
            </p>
            <p className="text-primary">
              <span className="font-semibold text-primary">Planned pricing after beta:</span>
            </p>
            <ul className="list-disc list-inside text-primary space-y-0.5 pl-1">
              <li>
                Premium Report Unlock — {ONE_TIME_UNLOCK.priceDisplay}
              </li>
              <li>
                ResuV Pro — {PRO_SUBSCRIPTION.priceDisplay}
                {PRO_SUBSCRIPTION.period}
              </li>
            </ul>
            <p className="text-primary font-medium">Everything is unlocked during beta — no payment required.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onPricingSoon}
          className="btn-ghost shrink-0 self-start sm:self-center border border-[rgba(255,255,255,0.55)] bg-white/50"
        >
          Pricing Coming Soon
        </button>
      </div>
    </div>
  );
}
