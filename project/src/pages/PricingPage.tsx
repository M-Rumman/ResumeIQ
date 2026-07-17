import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, X, ArrowRight, Loader2 } from 'lucide-react';
import LogoMark from '../components/LogoMark';
import ManageSubscriptionButton from '../components/ManageSubscriptionButton';
import { PRICING_PLANS } from '../lib/planConfig.js';
import type { PlanFeature, PricingPlan } from '../lib/planConfig.js';
import { PAYMENTS_ENABLED } from '../lib/paymentsConfig.js';
import { ONE_TIME_UNLOCK, PRO_SUBSCRIPTION } from '../lib/monetizationConfig.js';
import { supabase } from '../lib/supabase.js';
import { usePaywallCheckout } from '../hooks/usePaywallCheckout';
import { useUserPlan } from '../hooks/useUserPlan';
import {
  canManageSubscription,
  formatSubscriptionExpiry,
} from '../lib/formatSubscriptionExpiry.js';

interface PricingPageProps {
  onNavigate: (page: string) => void;
}

export default function PricingPage({ onNavigate }: PricingPageProps) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const requireAuth = useCallback(() => onNavigate('login'), [onNavigate]);

  const checkout = usePaywallCheckout({
    userId,
    reportId: null,
    onRequireAuth: requireAuth,
  });

  const { isPro, loading: planLoading, subscriptionStatus, subscriptionExpiresAt } = useUserPlan();
  const showManageSubscription = canManageSubscription(isPro, userId) && PAYMENTS_ENABLED;
  const cancelledGrace =
    subscriptionStatus.toLowerCase() === 'cancelled' &&
    Boolean(subscriptionExpiresAt) &&
    new Date(subscriptionExpiresAt!).getTime() > Date.now();
  const expiryLabel = cancelledGrace ? formatSubscriptionExpiry(subscriptionExpiresAt) : null;

  const plans = PRICING_PLANS.map((plan) => ({
    ...plan,
    ctaAction:
      plan.id === 'free'
        ? () => onNavigate('analyzer')
        : () => checkout.subscribePro(),
  }));

  return (
    <div className="min-h-screen">
      <div className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="section-label mb-3">Pricing</p>
          <h1 className="text-5xl lg:text-6xl text-primary">Simple, Transparent Pricing</h1>
          <p className="mt-4 text-lg text-body max-w-xl mx-auto">
            Start for free with daily limits. Upgrade to Pro for unlimited usage, PDF exports, advanced insights, and full history.
          </p>
          {!PAYMENTS_ENABLED && (
            <div className="mt-8 max-w-2xl mx-auto beta-banner text-left sm:text-center" role="note">
              <p className="text-sm font-bold text-primary mb-2">Free public beta — full access unlocked</p>
              <p className="text-sm text-body leading-relaxed mb-3">
                Payments (Lemon Squeezy) are coming soon. Enjoy every feature at no charge during beta.
              </p>
              <p className="text-sm text-body">
                <span className="font-semibold">Launch pricing:</span> Premium Report Unlock —{' '}
                {ONE_TIME_UNLOCK.priceDisplay} · ResuV Pro — {PRO_SUBSCRIPTION.priceDisplay}
                {PRO_SUBSCRIPTION.period}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {checkout.error && (
          <p className="text-center text-sm text-red-600 font-medium mb-6">{checkout.error}</p>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {plans.map((plan: PricingPlan & { ctaAction: () => void }) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-3xl overflow-hidden transition-all ${
                plan.highlight
                  ? 'glass-pro-highlight md:scale-[1.02]'
                  : 'glass-card'
              }`}
            >
              {plan.badge && (
                <div className="absolute top-5 right-5 skill-tag text-cta">{plan.badge}</div>
              )}

              <div className="p-8 border-b border-[rgba(255,255,255,0.35)]">
                <h2 className="text-2xl text-primary">{plan.name}</h2>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="font-display text-5xl text-primary">{plan.price}</span>
                  <span className="text-sm text-primary">{plan.period}</span>
                </div>
                <p className="mt-3 text-sm text-body">{plan.description}</p>
              </div>

              <div className="p-8 flex flex-col flex-1 gap-7">
                <ul className="space-y-3.5 flex-1">
                  {plan.features.map((feature: PlanFeature) => (
                    <li key={feature.text} className="flex items-center gap-3">
                      {feature.included ? (
                        <CheckCircle2
                          className={`flex-shrink-0 ${plan.highlight ? 'text-cta' : 'text-accent'}`}
                          style={{ width: '18px', height: '18px' }}
                        />
                      ) : (
                        <X
                          className="text-gray-500 flex-shrink-0"
                          style={{ width: '18px', height: '18px' }}
                        />
                      )}
                      <span
                        className="text-sm text-body"
                      >
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {(() => {
                  const isProCard = plan.id === 'pro';
                  const proActive = isProCard && isPro && Boolean(userId);
                  const buttonDisabled =
                    proActive ||
                    (!PAYMENTS_ENABLED && plan.id !== 'free') ||
                    checkout.processing ||
                    (isProCard && planLoading);

                  let buttonLabel = plan.cta;
                  if (!PAYMENTS_ENABLED && plan.id !== 'free') {
                    buttonLabel = 'Launching Soon';
                  } else if (proActive) {
                    buttonLabel = '✓ Pro Plan Active';
                  } else if (isProCard) {
                    buttonLabel = `Upgrade to Pro — ${PRO_SUBSCRIPTION.priceDisplay}${PRO_SUBSCRIPTION.period}`;
                  }

                  return (
                    <div className="space-y-3">
                      {proActive && expiryLabel && (
                        <p className="text-sm text-body text-center">
                          Pro access until {expiryLabel}. You can resume or update billing below.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={proActive ? undefined : plan.ctaAction}
                        disabled={buttonDisabled}
                        aria-disabled={buttonDisabled}
                        className={`w-full ${
                          proActive
                            ? 'btn-primary btn-cta ring-2 ring-green-500/30 bg-green-600 hover:bg-green-600'
                            : plan.highlight
                              ? 'btn-primary btn-cta'
                              : 'btn-ghost'
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        {checkout.processing && isProCard && !proActive ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : null}
                        {buttonLabel}
                        {!proActive && <ArrowRight className="w-4 h-4" />}
                      </button>
                      {proActive && showManageSubscription && (
                        <ManageSubscriptionButton />
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>

        {/* FAQ / Trust Section */}
        <div className="mt-20">
          <h2 className="text-4xl text-primary text-center mb-10">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                q: 'What are the Free plan daily limits?',
                a: 'Free accounts include 2 resume analyses and 2 interview prep sessions per day, plus access to basic ATS scoring and dashboard tools.',
              },
              {
                q: 'Is my resume data secure?',
                a: 'We take privacy seriously. Your resume data is encrypted and never shared with third parties.',
              },
              {
                q: 'What file formats are supported?',
                a: 'ResuV supports PDF and DOCX uploads, as well as plain text paste.',
              },
              {
                q: 'How do I upgrade to Pro?',
                a: 'Sign in and click Upgrade to Pro on this page or from any paywall. Checkout is powered by Lemon Squeezy.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="glass-card glass-card-interactive p-6">
                <h3 className="font-bold text-gray-900 text-sm mb-2">{q}</h3>
                <p className="text-sm text-body leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="mt-20 glass-modal p-12 text-center scroll-reveal">
          <LogoMark className="w-14 h-14 rounded-2xl mx-auto mb-5" />
          <h2 className="text-3xl font-extrabold text-primary">Ready to Land Your Dream Job?</h2>
          <p className="text-primary mt-3 max-w-md mx-auto text-base">
            Start with the free plan today. No credit card required.
          </p>
          <button
            onClick={() => onNavigate('analyzer')}
            className="mt-7 btn-primary"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
