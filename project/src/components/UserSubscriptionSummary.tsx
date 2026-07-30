import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, CheckCircle2, CircleDollarSign, Clock3, CreditCard, Crown, Sparkles } from 'lucide-react';
import ManageSubscriptionButton from './ManageSubscriptionButton';
import { useBilling } from '../context/BillingContext.js';
import { PAYMENTS_ENABLED } from '../lib/paymentsConfig.js';
import { formatSubscriptionExpiry } from '../lib/formatSubscriptionExpiry.js';
import { getDailyUsageCounters } from '../lib/usageLimits.js';
import { FREE_DAILY_INTERVIEW_LIMIT, FREE_DAILY_RESUME_LIMIT } from '../lib/planConfig.js';

interface Props { refreshKey?: number; userId?: string | null; onUpgrade?: () => void; }
type State = 'active' | 'cancelled' | 'expired' | 'free';

function remainingDays(expiresAt: string | null) {
  const ms = expiresAt ? new Date(expiresAt).getTime() : NaN;
  return Number.isFinite(ms) ? Math.max(0, Math.ceil((ms - Date.now()) / 86_400_000)) : null;
}

function Badge({ state }: { state: State }) {
  const styles: Record<State, string> = {
    active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    cancelled: 'border-orange-200 bg-orange-50 text-orange-700',
    expired: 'border-red-200 bg-red-50 text-red-700',
    free: 'border-gray-200 bg-gray-50 text-gray-700',
  };
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${styles[state]}`}>{state[0].toUpperCase() + state.slice(1)}</span>;
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-xl border border-gray-100 bg-gray-50 p-4"><div className="flex items-center gap-2 text-gray-500">{icon}<span className="text-xs font-bold uppercase tracking-wide">{label}</span></div><p className="mt-2 text-sm font-bold text-gray-900">{value}</p></div>;
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const value = Math.min(Math.max(used, 0), limit);
  return <div className="rounded-xl border border-gray-100 bg-gray-50 p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-gray-800">{label}</span><span className="text-sm font-extrabold text-gray-900">{value} / {limit}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-[#3c4a59]" style={{ width: `${Math.round((value / limit) * 100)}%` }} /></div></div>;
}

export default function UserSubscriptionSummary({ refreshKey = 0, userId = null, onUpgrade }: Props) {
  const { billing, isPro, plan, subscriptionStatus, subscriptionExpiresAt, loading, refresh } = useBilling();
  const [usage, setUsage] = useState({ resume: 0, interview: 0, loading: true });

  useEffect(() => { if (refreshKey > 0) void refresh(); }, [refreshKey, refresh]);
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (isPro || !userId) { if (mounted) setUsage({ resume: 0, interview: 0, loading: false }); return; }
      const counters = await getDailyUsageCounters(userId);
      if (mounted) setUsage({ resume: counters.resumeAnalysisCountToday, interview: counters.interviewPrepCountToday, loading: false });
    }
    void load(); return () => { mounted = false; };
  }, [isPro, refreshKey, userId]);

  const state = useMemo<State>(() => {
    const status = subscriptionStatus.toLowerCase();
    if (status === 'cancelled') return 'cancelled';
    if (isPro) return 'active';
    if (status === 'expired' || plan === 'pro') return 'expired';
    return 'free';
  }, [isPro, plan, subscriptionStatus]);
  const days = remainingDays(subscriptionExpiresAt);
  const cancelledActive = state === 'cancelled' && days !== null && days > 0;
  const date = formatSubscriptionExpiry(subscriptionExpiresAt) ?? 'Not available';
  const error = billing === null && !loading;

  return <section className="glass-card overflow-hidden border border-gray-200 shadow-sm" aria-labelledby="subscription-card-heading">
    <div className="flex flex-col gap-4 border-b border-gray-100 bg-gradient-to-r from-[#f7fafc] to-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#3c4a59] text-white">{state === 'active' || cancelledActive ? <Crown className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}</div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Subscription</p><h3 id="subscription-card-heading" className="mt-0.5 text-xl font-extrabold text-gray-900">{state === 'active' || cancelledActive ? 'ResuV Pro' : state === 'expired' ? 'Subscription Expired' : 'Free Plan'}</h3></div></div>
      {loading ? <div className="h-7 w-20 animate-pulse rounded-full bg-gray-100" /> : <Badge state={state} />}
    </div>
    <div className="p-5 sm:p-7">
      {loading || usage.loading ? <div className="h-36 animate-pulse rounded-2xl bg-gray-100" /> : error ? <p className="text-sm font-medium text-red-600">Could not load your subscription details.</p> : state === 'free' ? <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-gray-900">Free Plan</p><p className="mt-1 text-sm text-gray-700">2 Resume Analyses per day · 2 Interview Prep sessions per day</p></div><button type="button" onClick={onUpgrade} className="btn-primary whitespace-nowrap"><Sparkles className="h-4 w-4" />Upgrade to Pro</button></div>
        <div><h4 className="mb-3 text-sm font-bold text-gray-900">Today&apos;s Usage</h4><div className="grid gap-3 sm:grid-cols-2"><UsageBar label="Resume Analysis" used={usage.resume} limit={FREE_DAILY_RESUME_LIMIT} /><UsageBar label="Interview Prep" used={usage.interview} limit={FREE_DAILY_INTERVIEW_LIMIT} /></div></div>
      </div> : state === 'expired' ? <div className="space-y-5"><div className="rounded-2xl border border-red-100 bg-red-50 p-5"><p className="font-bold text-red-900">Your Pro subscription has expired.</p><p className="mt-1 text-sm text-red-800">Current Plan: Free</p></div><button type="button" onClick={onUpgrade} className="btn-primary"><Sparkles className="h-4 w-4" />Upgrade Again</button></div> : <div className="space-y-5">
        {cancelledActive && <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm text-orange-900">Your subscription has been cancelled and will automatically revert to the Free plan on expiry.</div>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Detail icon={<CalendarDays className="h-4 w-4" />} label={cancelledActive ? 'Cancels on' : 'Next Renewal'} value={date} /><Detail icon={<Clock3 className="h-4 w-4" />} label="Days Remaining" value={days === null ? 'Not available' : `${days} ${days === 1 ? 'Day' : 'Days'}`} /><Detail icon={<CheckCircle2 className="h-4 w-4" />} label="Auto Renew" value={cancelledActive ? 'Disabled' : 'Enabled'} /><Detail icon={<CircleDollarSign className="h-4 w-4" />} label="Current Plan" value="$5 Monthly" /></div>
        <p className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700"><span className="font-semibold text-gray-900">Subscription Started:</span> Available from your billing history.</p>
        {PAYMENTS_ENABLED && <div className="grid gap-3 sm:grid-cols-2"><ManageSubscriptionButton variant="primary" label={cancelledActive ? 'Renew Subscription' : 'Manage Subscription'} /><ManageSubscriptionButton label="Billing Portal" /></div>}
      </div>}
    </div>
  </section>;
}
