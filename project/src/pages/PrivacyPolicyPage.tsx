import { Shield } from 'lucide-react';
import StaticPageLayout from '../components/StaticPageLayout';
import StaticPageSection from '../components/StaticPageSection';

import { SUPPORT_EMAIL } from '../lib/supportEmail.js';

export default function PrivacyPolicyPage() {
  return (
    <StaticPageLayout
      title="Privacy Policy"
      subtitle="Last updated: May 2026"
      icon={Shield}
    >
      <div className="space-y-6">
        <p className="text-sm sm:text-base text-primary leading-relaxed">
          ResuV (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates an AI-powered resume optimization
          and interview preparation platform. This Privacy Policy describes how we collect, use, store,
          and protect your information when you use our website and services.
        </p>

        <StaticPageSection title="Information we collect">
          <ul className="list-disc list-inside space-y-2 pl-1">
            <li>
              <strong className="text-primary">Account data:</strong> name, email address, and authentication
              credentials when you register or sign in.
            </li>
            <li>
              <strong className="text-primary">Resume content:</strong> text extracted from uploaded PDF or
              DOCX files, or resume text you paste directly into the analyzer.
            </li>
            <li>
              <strong className="text-primary">Job context:</strong> job descriptions, target roles, skills,
              and experience level you provide for analysis or interview prep.
            </li>
            <li>
              <strong className="text-primary">Usage data:</strong> feature usage counts, analysis history,
              session metadata, and technical logs needed to operate and secure the service.
            </li>
            <li>
              <strong className="text-primary">Payment data:</strong> subscription and purchase status. Payment
              card details are processed by our payment provider; we do not store full card numbers on our servers.
            </li>
          </ul>
        </StaticPageSection>

        <StaticPageSection title="How we use your information">
          <p>We use collected information to:</p>
          <ul className="list-disc list-inside space-y-2 pl-1">
            <li>Provide resume ATS scoring, keyword suggestions, and improvement recommendations.</li>
            <li>Generate interview questions, preparation tips, and related coaching content.</li>
            <li>Save your analysis and interview prep history to your dashboard.</li>
            <li>Enforce plan limits, process payments, and manage subscription access.</li>
            <li>Improve product reliability, security, and user experience.</li>
            <li>Respond to support requests and send service-related communications.</li>
          </ul>
        </StaticPageSection>

        <StaticPageSection title="Uploaded resumes & document handling">
          <p>
            When you upload a resume file, parsing may occur in your browser or on our servers depending
            on the feature. Extracted text is used solely to generate your analysis results and, if you
            are signed in, to store a record linked to your account.
          </p>
          <p>
            We do not sell your resume content. We do not use your resume to train public AI models without
            your explicit consent. You may delete saved analyses from your account history where the
            product supports deletion, or request account data removal by contacting us.
          </p>
        </StaticPageSection>

        <StaticPageSection title="AI processing disclosure">
          <p>
            ResuV uses artificial intelligence, including third-party language models accessed via
            secure API providers (such as OpenRouter), to analyze resumes and generate interview
            preparation content. When you run an analysis or generate interview prep:
          </p>
          <ul className="list-disc list-inside space-y-2 pl-1">
            <li>Relevant portions of your resume text and job context may be sent to AI providers for processing.</li>
            <li>AI outputs are generated automatically and should be reviewed by you before use in job applications.</li>
            <li>We apply reasonable technical safeguards, but AI-generated content may contain errors or omissions.</li>
          </ul>
          <p>
            By using AI-powered features, you acknowledge that your submitted content will be processed
            for the purpose of delivering the requested service.
          </p>
        </StaticPageSection>

        <StaticPageSection title="Data storage & security">
          <p>
            Data is stored using Supabase and other secure cloud infrastructure. We use industry-standard
            measures including encryption in transit (HTTPS), access controls, and row-level security
            policies so users can only access their own records.
          </p>
          <p>
            No method of transmission or storage is 100% secure. You are responsible for maintaining the
            confidentiality of your account credentials.
          </p>
        </StaticPageSection>

        <StaticPageSection title="Data retention">
          <p>
            We retain account and usage data while your account is active and as needed to provide the
            service, comply with legal obligations, resolve disputes, and enforce agreements. You may
            request deletion of your account and associated data by emailing{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#3c4a59] font-semibold hover:underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </StaticPageSection>

        <StaticPageSection title="Your rights & choices">
          <p>Depending on your location, you may have the right to:</p>
          <ul className="list-disc list-inside space-y-2 pl-1">
            <li>Access, correct, or delete personal data we hold about you.</li>
            <li>Object to or restrict certain processing activities.</li>
            <li>Export your data in a portable format where technically feasible.</li>
          </ul>
          <p>
            To exercise these rights, contact{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#3c4a59] font-semibold hover:underline">
              {SUPPORT_EMAIL}
            </a>
            . We will respond within a reasonable timeframe.
          </p>
        </StaticPageSection>

        <StaticPageSection title="Third-party services">
          <p>We rely on trusted third parties to operate ResuV, including:</p>
          <ul className="list-disc list-inside space-y-2 pl-1">
            <li>Supabase (authentication and database)</li>
            <li>Payment processors (when billing is enabled)</li>
            <li>AI model providers via OpenRouter (content generation)</li>
            <li>Vercel (hosting)</li>
          </ul>
          <p>These providers process data according to their own privacy policies and our agreements with them.</p>
        </StaticPageSection>

        <StaticPageSection title="Changes to this policy">
          <p>
            We may update this Privacy Policy periodically. The &quot;Last updated&quot; date at the top reflects
            the most recent revision. Continued use of ResuV after changes constitutes acceptance of
            the updated policy.
          </p>
        </StaticPageSection>
      </div>
    </StaticPageLayout>
  );
}
