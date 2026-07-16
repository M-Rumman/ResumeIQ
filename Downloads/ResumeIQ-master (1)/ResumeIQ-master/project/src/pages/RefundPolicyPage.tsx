import { RotateCcw } from 'lucide-react';
import StaticPageLayout from '../components/StaticPageLayout';
import StaticPageSection from '../components/StaticPageSection';

import { SUPPORT_EMAIL } from '../lib/supportEmail.js';

export default function RefundPolicyPage() {
  return (
    <StaticPageLayout
      title="Refund Policy"
      subtitle="Last updated: May 2026"
      icon={RotateCcw}
    >
      <div className="space-y-6">
        <p className="text-sm sm:text-base text-primary leading-relaxed">
          This Refund Policy explains how ResuV handles refunds for Pro subscriptions and
          one-time premium report unlocks when paid billing is enabled.
        </p>

        <StaticPageSection title="One-time report unlock ($2)">
          <p>
            One-time purchases unlock the full results for a single resume analysis or interview
            preparation session. Because digital content is delivered immediately after payment,
            one-time unlocks are generally non-refundable once the report has been unlocked.
          </p>
          <p>
            If you were charged but did not receive access to your report within 24 hours, contact
            us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#3c4a59] font-semibold hover:underline">
              {SUPPORT_EMAIL}
            </a>{' '}
            with your account email and transaction details. We will investigate and issue a refund or
            manual unlock when appropriate.
          </p>
        </StaticPageSection>

        <StaticPageSection title="Pro subscription ($9/month)">
          <p>
            Pro subscriptions renew automatically each billing period until canceled. You may cancel
            at any time through your account settings or by contacting support. Cancellation stops
            future charges; it does not automatically refund the current billing period unless
            required by applicable law.
          </p>
          <p>
            If you cancel within 7 days of your first Pro subscription charge and have not
            substantially used premium features during that period, you may request a full refund.
            Refund eligibility is reviewed on a case-by-case basis.
          </p>
        </StaticPageSection>

        <StaticPageSection title="Duplicate or erroneous charges">
          <p>
            If you believe you were charged in error, charged twice for the same unlock, or charged
            after canceling your subscription, contact us promptly. Verified duplicate charges will
            be refunded.
          </p>
        </StaticPageSection>

        <StaticPageSection title="How to request a refund">
          <ol className="list-decimal list-inside space-y-2 pl-1">
            <li>Email {SUPPORT_EMAIL} from the address linked to your ResuV account.</li>
            <li>Include the date of purchase and a brief description of the issue.</li>
            <li>If available, include your payment receipt or transaction reference.</li>
          </ol>
          <p className="text-sm text-primary pt-1">
            We aim to respond within 2–3 business days. Approved refunds are returned to your original
            payment method and may take 5–10 business days to appear.
          </p>
        </StaticPageSection>

        <StaticPageSection title="Changes to this policy">
          <p>
            We may update this Refund Policy from time to time. Material changes will be reflected
            on this page with an updated &quot;Last updated&quot; date.
          </p>
        </StaticPageSection>
      </div>
    </StaticPageLayout>
  );
}
