import { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, RefreshCw } from 'lucide-react';
import LogoMark from '../components/LogoMark';
import UserSubscriptionSummary from '../components/UserSubscriptionSummary';
import ResumeAnalysisHistory from '../components/ResumeAnalysisHistory';
import InterviewPrepHistory from '../components/InterviewPrepHistory';
import DashboardAnalytics from '../components/DashboardAnalytics';
import ProFeatureGate from '../components/ProFeatureGate';
import { useUserPlan } from '../hooks/useUserPlan';
import { usePaywallCheckout } from '../hooks/usePaywallCheckout';
import { getEffectivePro, getHistoryLimit } from '../lib/planAccess.js';
import { usePaywallAccess } from '../hooks/usePaywallAccess';
import { apiPost } from '../lib/api/client.js';
import { BILLING_REFRESH_KEY } from '../lib/billingRefresh.js';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { isPro, loading: planLoading } = useUserPlan(refreshKey);
  const effectivePro = getEffectivePro(isPro);
  const historyLimit = getHistoryLimit(isPro);
  const { userId } = usePaywallAccess(null);

  const requireAuth = useCallback(() => onNavigate('login'), [onNavigate]);

  const checkout = usePaywallCheckout({
    userId,
    reportId: null,
    onRequireAuth: requireAuth,
  });

  useEffect(() => {
    if (!sessionStorage.getItem(BILLING_REFRESH_KEY)) return;
    sessionStorage.removeItem(BILLING_REFRESH_KEY);
    void apiPost('/api/billing/sync', {}).finally(() => {
      setRefreshKey((key) => key + 1);
    });
  }, []);

  function handleRefresh() {
    setRefreshKey((key) => key + 1);
    void apiPost('/api/billing/sync', {}).catch(() => undefined);
  }

  function handleUpgrade() {
    void checkout.subscribePro();
  }

  return (
    <div className="min-h-screen">
      <div className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <LogoMark className="w-10 h-10 rounded-xl" />
                <h1 className="text-3xl font-extrabold text-gray-900">Dashboard</h1>
              </div>
              <p className="text-primary text-base ml-[52px]">
                Your subscription, resume analyses, and interview prep history in one place.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center justify-center gap-2 self-start sm:self-auto text-sm font-semibold text-gray-600 hover:text-gray-900 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh All
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {checkout.error && (
          <p className="text-sm text-red-600 font-medium">{checkout.error}</p>
        )}

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-[#3c4a59]" />
            <h2 className="text-lg font-bold text-gray-900">Subscription</h2>
          </div>
          <UserSubscriptionSummary refreshKey={refreshKey} />
        </section>

        {!planLoading && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Analytics</h2>
            {effectivePro ? (
              <DashboardAnalytics refreshKey={refreshKey} />
            ) : (
              <ProFeatureGate
                isPro={false}
                title="Enhanced Dashboard Analytics"
                description="Track total analyses, interview sessions, average ATS score, and weekly activity with Pro."
                onUpgrade={handleUpgrade}
              >
                <DashboardAnalytics refreshKey={refreshKey} />
              </ProFeatureGate>
            )}
          </section>
        )}

        <ResumeAnalysisHistory
          refreshKey={refreshKey}
          isPro={effectivePro}
          historyLimit={historyLimit}
          onUpgrade={handleUpgrade}
        />
        <InterviewPrepHistory
          refreshKey={refreshKey}
          isPro={effectivePro}
          historyLimit={historyLimit}
          onUpgrade={handleUpgrade}
        />
      </div>
    </div>
  );
}
