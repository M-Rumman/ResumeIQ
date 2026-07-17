import { useState } from 'react';
import PaywallOverlay from './PaywallOverlay';
import { PAYWALL_PREVIEW_PERCENT, getFreeTrialExhaustedMessage, parseReportId } from '../lib/monetizationConfig.js';
import { PAYMENTS_ENABLED } from '../lib/paymentsConfig.js';

interface PaywallBlurGateProps {
  unlocked: boolean;
  /** Height of clear preview inside this gate (0 = lock entire block). */
  previewPercent?: number;
  reportId: string;
  onUnlockReport: () => Promise<void>;
  onSubscribePro: () => Promise<void>;
  children: React.ReactNode;
}

export default function PaywallBlurGate({
  unlocked,
  previewPercent = PAYWALL_PREVIEW_PERCENT,
  reportId,
  onUnlockReport,
  onSubscribePro,
  children,
}: PaywallBlurGateProps) {
  const [processing, setProcessing] = useState(false);

  if (!PAYMENTS_ENABLED || unlocked) {
    return <>{children}</>;
  }

  async function handleUnlock() {
    setProcessing(true);
    try {
      await onUnlockReport();
    } finally {
      setProcessing(false);
    }
  }

  async function handlePro() {
    setProcessing(true);
    try {
      await onSubscribePro();
    } finally {
      setProcessing(false);
    }
  }

  function scrollToFreePreview() {
    document.getElementById('paywall-free-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const { type: reportType } = parseReportId(reportId);
  const limitMessage = getFreeTrialExhaustedMessage(reportType);

  return (
    <div className="paywall-gate relative" data-report-id={reportId}>
      <div className="paywall-content">{children}</div>

      <div
        className="paywall-locked-region"
        style={{ top: `${previewPercent}%` }}
      >
        <div className="paywall-frost" aria-hidden />
        <PaywallOverlay
          processing={processing}
          paymentsEnabled={PAYMENTS_ENABLED}
          limitMessage={limitMessage}
          onUnlockReport={handleUnlock}
          onSubscribePro={handlePro}
          onDismissPreview={scrollToFreePreview}
        />
      </div>
    </div>
  );
}
