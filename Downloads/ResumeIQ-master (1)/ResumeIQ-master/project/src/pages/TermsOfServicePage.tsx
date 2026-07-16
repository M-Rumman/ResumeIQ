import { FileText } from 'lucide-react';
import StaticPageLayout from '../components/StaticPageLayout';
import StaticPageSection from '../components/StaticPageSection';

import { SUPPORT_EMAIL } from '../lib/supportEmail.js';

export default function TermsOfServicePage() {
  return (
    <StaticPageLayout
      title="Terms of Service"
      subtitle="Last updated: May 2026"
      icon={FileText}
    >
      <div className="space-y-6">
        <p className="text-sm sm:text-base text-primary leading-relaxed">
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of ResuV, an AI-powered
          resume optimization and interview preparation platform. By creating an account or using the
          service, you agree to these Terms.
        </p>

        <StaticPageSection title="Service description">
          <p>
            ResuV provides tools to analyze resumes for ATS compatibility, suggest improvements,
            generate interview preparation content, and save your history in a personal dashboard.
            Features may vary by plan (Free, Pro, or one-time unlocks).
          </p>
        </StaticPageSection>

        <StaticPageSection title="Accounts & eligibility">
          <p>
            You must be at least 16 years old and able to form a binding contract to use ResuV. You
            agree to provide accurate registration information and keep your login credentials secure.
            You are responsible for all activity under your account.
          </p>
        </StaticPageSection>

        <StaticPageSection title="Plans, payments & subscriptions">
          <ul className="list-disc list-inside space-y-2 pl-1">
            <li>
              <strong className="text-primary">Free plan:</strong> limited daily usage with partial
              previews of premium results.
            </li>
            <li>
              <strong className="text-primary">Pro subscription ($9/month):</strong> unlimited access to
              full resume and interview prep results, subject to fair use.
            </li>
            <li>
              <strong className="text-primary">One-time unlock ($2):</strong> full access to a single
              report without a subscription.
            </li>
          </ul>
          <p>
            When billing is enabled, payments are processed by our third-party payment provider. By
            purchasing, you also agree to that provider&apos;s applicable terms. Subscriptions renew
            automatically until canceled. Prices may change with reasonable
            notice; continued use after a price change constitutes acceptance.
          </p>
          <p>
            Refunds are governed by our{' '}
            <a href="/refund-policy" className="text-[#3c4a59] font-semibold hover:underline">
              Refund Policy
            </a>
            . See that page for eligibility and how to request a refund.
          </p>
        </StaticPageSection>

        <StaticPageSection title="AI-generated content">
          <p>
            ResuV uses artificial intelligence to produce suggestions, scores, and interview content.
            Outputs are informational only and do not constitute legal, career, or hiring advice. We do
            not guarantee employment outcomes, interview success, or ATS pass rates.
          </p>
          <p>
            You are solely responsible for reviewing and verifying all AI-generated content before
            submitting resumes or using answers in real interviews.
          </p>
        </StaticPageSection>

        <StaticPageSection title="Your content">
          <p>
            You retain ownership of resume and job-related content you submit. You grant ResuV a
            limited license to process, store, and display that content solely to provide the service
            to you. Do not upload content you do not have the right to share or that violates applicable law.
          </p>
        </StaticPageSection>

        <StaticPageSection title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc list-inside space-y-2 pl-1">
            <li>Reverse engineer, scrape, or abuse the platform or its APIs.</li>
            <li>Share account credentials or resell access to the service.</li>
            <li>Upload malware, unlawful content, or others&apos; personal data without consent.</li>
            <li>Circumvent usage limits, paywalls, or access controls.</li>
            <li>Use the service in a manner that harms ResuV, other users, or third parties.</li>
          </ul>
        </StaticPageSection>

        <StaticPageSection title="Intellectual property">
          <p>
            ResuV, its branding, software, and design are owned by us or our licensors. These Terms
            do not grant you any rights to our trademarks or proprietary materials except as needed to
            use the service.
          </p>
        </StaticPageSection>

        <StaticPageSection title="Disclaimer of warranties">
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
            EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
            NON-INFRINGEMENT.
          </p>
        </StaticPageSection>

        <StaticPageSection title="Limitation of liability">
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, RESUV AND ITS AFFILIATES SHALL NOT BE LIABLE FOR
            ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
            PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
          </p>
        </StaticPageSection>

        <StaticPageSection title="Termination">
          <p>
            We may suspend or terminate your account if you violate these Terms or if required for legal
            or security reasons. You may stop using the service at any time. Provisions that by nature
            should survive termination will remain in effect.
          </p>
        </StaticPageSection>

        <StaticPageSection title="Contact">
          <p>
            Questions about these Terms:{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#3c4a59] font-semibold hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </StaticPageSection>
      </div>
    </StaticPageLayout>
  );
}
