import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { getDailyUsageCounters } from '../lib/usageLimits.js';
import { FREE_DAILY_INTERVIEW_LIMIT, FREE_DAILY_RESUME_LIMIT } from '../lib/planConfig.js';
import { useBilling } from '../context/BillingContext.js';

interface DailyUsageSummaryProps {
  refreshKey?: number;
}

export default function DailyUsageSummary({ refreshKey = 0 }: DailyUsageSummaryProps) {
  const { isPro, loading: billingLoading } = useBilling();
  const [usage, setUsage] = useState({ resume: 0, interview: 0, loading: true });

  useEffect(() => {
    let active = true;
    async function load() {
      if (isPro) {
        if (active) setUsage({ resume: 0, interview: 0, loading: false });
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (active) setUsage({ resume: 0, interview: 0, loading: false });
        return;
      }
      const counters = await getDailyUsageCounters(user.id);
      if (active) {
        setUsage({
          resume: counters.resumeAnalysisCountToday,
          interview: counters.interviewPrepCountToday,
          loading: false,
        });
      }
    }
    void load();
    return () => { active = false; };
  }, [isPro, refreshKey]);

  return (
    <section className="glass-card p-5 sm:p-6" aria-labelledby="daily-usage-heading">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[#3c4a59]" />
        <h3 id="daily-usage-heading" className="text-sm font-bold text-gray-900">Today&apos;s Usage</h3>
      </div>
      {billingLoading || usage.loading ? (
        <div className="mt-4 h-12 rounded-lg bg-gray-100 animate-pulse" />
      ) : isPro ? (
        <p className="mt-4 text-sm font-semibold text-emerald-700">Unlimited with ResuV Pro</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <UsageRow label="Resume Analysis" used={usage.resume} limit={FREE_DAILY_RESUME_LIMIT} />
          <UsageRow label="Interview Prep" used={usage.interview} limit={FREE_DAILY_INTERVIEW_LIMIT} />
        </div>
      )}
    </section>
  );
}

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <p className="text-xs font-semibold text-gray-600">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-gray-900">{Math.min(used, limit)} / {limit}</p>
    </div>
  );
}
