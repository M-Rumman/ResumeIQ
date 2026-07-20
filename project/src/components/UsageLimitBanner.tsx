interface UsageLimitBannerProps {
  used: number;
  limit: number;
  featureLabel: string;
  isPro?: boolean;
}

export default function UsageLimitBanner({ used, limit, featureLabel, isPro }: UsageLimitBannerProps) {
  if (isPro) {
    return (
      <p className="text-center text-xs text-[#3c4a59] font-medium">
        Pro plan — unlimited {featureLabel}.
      </p>
    );
  }

  const remaining = Math.max(0, limit - used);

  return (
    <p className="text-center text-xs text-primary">
      Free plan: <span className="font-semibold text-gray-700">{featureLabel}</span>{' '}
      <span className="font-semibold text-gray-700">{used} / {limit}</span> used today
      {remaining > 0 ? ` (${remaining} available today).` : '. Your limit resets tomorrow.'}
    </p>
  );
}
