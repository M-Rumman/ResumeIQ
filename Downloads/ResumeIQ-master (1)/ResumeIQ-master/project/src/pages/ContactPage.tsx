import { Mail, MessageCircle, Clock, HelpCircle } from 'lucide-react';
import StaticPageLayout from '../components/StaticPageLayout';
import StaticPageSection from '../components/StaticPageSection';
import { SUPPORT_EMAIL } from '../lib/supportEmail.js';
import { ONE_TIME_UNLOCK, PRO_SUBSCRIPTION } from '../lib/monetizationConfig.js';

export default function ContactPage() {
  return (
    <StaticPageLayout
      title="Contact Us"
      subtitle="Support, billing questions, and general inquiries."
      icon={Mail}
    >
      <div className="space-y-6">
        <p className="text-sm sm:text-base text-gray-900 leading-relaxed">
          We&apos;re here to help with account issues, resume analysis questions, interview prep features,
          subscriptions, and refunds. Reach out using the options below.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="neu-surface rounded-[var(--radius-lg)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-5 h-5 text-[#3c4a59]" />
              <h3 className="font-bold text-primary text-sm">Email support</h3>
            </div>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-[#3c4a59] font-semibold hover:underline break-all"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
          <div className="neu-surface rounded-[var(--radius-lg)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-[#3c4a59]" />
              <h3 className="font-bold text-primary text-sm">Response time</h3>
            </div>
            <p className="text-sm text-primary">We aim to reply within 2–3 business days.</p>
          </div>
        </div>

        <StaticPageSection title="What we can help with">
          <ul className="list-disc list-inside space-y-2 pl-1">
            <li>Account access, login, and password issues</li>
            <li>Resume upload, analysis results, and interview prep questions</li>
            <li>Pro subscriptions, one-time unlocks, and billing questions</li>
            <li>Refund requests (see our Refund Policy)</li>
            <li>Privacy, data deletion, and security concerns</li>
            <li>Partnerships and general feedback</li>
          </ul>
        </StaticPageSection>

        <StaticPageSection title="Before you write">
          <div className="flex gap-3 items-start">
            <HelpCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <p>
              Please include the email address associated with your ResuV account and a clear
              description of the issue. For payment problems, include the date of charge and any receipt
              reference from your payment receipt if available.
            </p>
          </div>
        </StaticPageSection>

        <StaticPageSection title="Billing & subscriptions">
          <p>
            <strong className="text-primary">ResuV Pro</strong> ({PRO_SUBSCRIPTION.priceDisplay}
            {PRO_SUBSCRIPTION.period}) includes unlimited resume analyses and interview prep sessions,
            PDF exports, full report history, and enhanced dashboard analytics.{' '}
            <strong className="text-primary">Premium report unlocks</strong> are{' '}
            {ONE_TIME_UNLOCK.priceDisplay} each when you want full access to a single report without a
            subscription.
          </p>
          <p>
            Payments are processed securely by Lemon Squeezy. After checkout, your plan and subscription
            status appear on your Dashboard. If you cancel Pro, you keep access until the end of your
            current billing period. One-time report unlocks stay available permanently on your account.
          </p>
          <p>
            For billing questions, failed charges, subscription status, or refund requests, email{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-[#3c4a59] font-semibold hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>{' '}
            with your ResuV account email and any Lemon Squeezy receipt or order reference.
          </p>
        </StaticPageSection>

        <div className="glass-card p-5 flex gap-3 items-start border border-[rgba(255,255,255,0.4)]">
          <MessageCircle className="w-5 h-5 text-[#3c4a59] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-primary leading-relaxed">
            ResuV is an early-access career platform. Your feedback helps us improve resume scoring,
            interview prep quality, and the overall experience. We read every message.
          </p>
        </div>
      </div>
    </StaticPageLayout>
  );
}
