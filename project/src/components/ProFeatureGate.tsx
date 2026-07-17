import { Lock } from 'lucide-react';

interface ProFeatureGateProps {
  isPro: boolean;
  title: string;
  description: string;
  onUpgrade: () => void;
  children: React.ReactNode;
}

export default function ProFeatureGate({
  isPro,
  title,
  description,
  onUpgrade,
  children,
}: ProFeatureGateProps) {
  if (isPro) return <>{children}</>;

  return (
    <div className="relative glass-card overflow-hidden">
      <div className="pointer-events-none select-none blur-sm opacity-60 max-h-48 overflow-hidden">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(221,225,231,0.75)] backdrop-blur-md p-6 text-center">
        <div className="w-10 h-10 neu-surface rounded-[var(--radius-md)] flex items-center justify-center mb-3">
          <Lock className="w-5 h-5 text-accent" />
        </div>
        <h4 className="font-bold text-primary text-sm mb-1">{title}</h4>
        <p className="text-xs text-body max-w-xs mb-4">{description}</p>
        <button type="button" onClick={onUpgrade} className="btn-primary text-sm py-2 px-4">
          Upgrade to Pro
        </button>
      </div>
    </div>
  );
}
