import { Sparkles, ArrowRight } from 'lucide-react';

interface UpgradePromptProps {
  message: string;
  onUpgrade: () => void;
}

export default function UpgradePrompt({ message, onUpgrade }: UpgradePromptProps) {
  return (
    <div className="glass-card p-6 text-center max-w-lg mx-auto">
      <div className="w-12 h-12 neu-surface rounded-xl flex items-center justify-center mx-auto mb-4">
        <Sparkles className="w-6 h-6 text-[#3c4a59]" />
      </div>
      <p className="text-sm text-gray-800 font-medium leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onUpgrade}
        className="mt-4 btn-primary"
      >
        Upgrade to Pro
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
