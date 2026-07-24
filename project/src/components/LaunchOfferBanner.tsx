import { Rocket } from 'lucide-react';
import { FREE_LAUNCH_MESSAGE } from '../lib/launchConfig.js';

interface LaunchOfferBannerProps {
  onViewPricing: () => void;
}

export default function LaunchOfferBanner({ onViewPricing }: LaunchOfferBannerProps) {
  return (
    <div className="beta-banner" role="status" aria-label="ResuV launch offer">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-[#3c4a59]" aria-hidden="true" />
          <div>
            <p className="font-bold text-primary">Launch Offer — Currently Free</p>
            <p className="mt-1 text-sm leading-relaxed text-primary">{FREE_LAUNCH_MESSAGE}</p>
          </div>
        </div>
        <button type="button" onClick={onViewPricing} className="btn-ghost shrink-0 self-start text-sm sm:self-auto">
          View pricing
        </button>
      </div>
    </div>
  );
}
