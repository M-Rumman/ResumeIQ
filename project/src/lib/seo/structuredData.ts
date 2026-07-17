import {
  SEO_DEFAULT_DESCRIPTION,
  SEO_LOGO_URL,
  SEO_OG_IMAGE_URL,
  SEO_SITE_NAME,
  SEO_SITE_URL,
  seoCanonicalUrl,
} from './config.js';
import { SUPPORT_EMAIL } from '../supportEmail.js';
import type { PageSeoMeta, SeoPageKey } from './pageMeta.js';

export const ORGANIZATION_ID = `${SEO_SITE_URL}/#organization`;
export const WEBSITE_ID = `${SEO_SITE_URL}/#website`;
export const SOFTWARE_APPLICATION_ID = `${SEO_SITE_URL}/#softwareapplication`;

/** Matches FAQ content on the Pricing page — do not invent entries. */
export const PRICING_FAQ_ENTRIES = [
  {
    question: 'What are the Free plan daily limits?',
    answer:
      'Free accounts include 2 resume analyses and 2 interview prep sessions per day, plus access to basic ATS scoring and dashboard tools.',
  },
  {
    question: 'Is my resume data secure?',
    answer: 'We take privacy seriously. Your resume data is encrypted and never shared with third parties.',
  },
  {
    question: 'What file formats are supported?',
    answer: 'ResuV supports PDF and DOCX uploads, as well as plain text paste.',
  },
  {
    question: 'How do I upgrade to Pro?',
    answer:
      'Sign in and click Upgrade to Pro on this page or from any paywall. Checkout is powered by Lemon Squeezy.',
  },
] as const;

/** Matches FAQ on /resume-analyzer landing page. */
export const RESUME_ANALYZER_LANDING_FAQ_ENTRIES = [
  {
    question: 'What is an AI Resume Analyzer?',
    answer:
      'An AI resume analyzer reviews your resume against a job description and highlights ATS risks, missing keywords, structural issues, and improvement opportunities. ResuV provides this analysis so you can refine your resume before submitting applications.',
  },
  {
    question: 'How does ATS software work?',
    answer:
      'Applicant Tracking Systems parse resumes into structured data, then rank or filter candidates based on keywords, skills, experience, and formatting. ResuV helps you understand how your resume may be interpreted by similar screening workflows.',
  },
  {
    question: 'Can AI improve my resume?',
    answer:
      'AI cannot replace your judgment, but it can surface gaps, suggest stronger wording, and highlight keywords to add. You stay in control of every edit while using ResuV recommendations to tailor your resume for each role.',
  },
  {
    question: 'Is my resume stored?',
    answer:
      'When you are signed in, ResuV can save analysis history to your account so you can revisit reports from your dashboard. See our Privacy Policy for how data is handled.',
  },
  {
    question: 'Is ResuV free?',
    answer:
      'ResuV offers a free tier with access to resume analysis and interview preparation features. Pro plans unlock additional usage and full report access. Visit our Pricing page for current plan details.',
  },
  {
    question: 'How accurate is the analysis?',
    answer:
      'Analysis quality depends on the completeness of your resume text and job description. ResuV uses AI to provide detailed, role-specific feedback, but you should review suggestions and apply only changes that reflect your real experience.',
  },
  {
    question: 'How long does it take?',
    answer:
      'Most analyses complete within a short wait after you submit your resume and job description. Timing can vary slightly based on input length and system load.',
  },
  {
    question: 'Can I analyze multiple resumes?',
    answer:
      'Yes. Signed-in users can run additional analyses and build a history of reports over time, subject to your plan limits.',
  },
] as const;

/** Matches FAQ on /ai-interview-preparation landing page. */
export const INTERVIEW_PREP_LANDING_FAQ_ENTRIES = [
  {
    question: 'What is AI interview preparation?',
    answer:
      'AI interview preparation uses artificial intelligence to generate role-specific interview questions, answer guidance, and preparation tips. ResuV helps you practice before a real interview by organizing questions and feedback around your target job.',
  },
  {
    question: 'Can AI improve interview skills?',
    answer:
      'AI cannot replace live practice with people, but it can help you anticipate questions, structure answers, and identify weak spots. ResuV gives you a focused prep report you can rehearse from before your next interview.',
  },
  {
    question: 'How many interviews can I practice?',
    answer:
      'You can generate additional interview prep sessions based on your plan limits. Free and Pro tiers have different usage allowances—see the Pricing page for current details.',
  },
  {
    question: 'Does ResuV save my answers?',
    answer:
      'ResuV saves your generated interview prep reports to your account when you are signed in, so you can revisit question sets and guidance from your dashboard.',
  },
  {
    question: 'Can I practice technical interviews?',
    answer:
      'Yes. ResuV generates technical question sets alongside HR and behavioral prompts when you specify a technical or role-specific target job.',
  },
  {
    question: 'How does AI evaluate responses?',
    answer:
      'ResuV provides suggested ideal answers, tips, and follow-up questions rather than scoring your spoken responses in real time. You use the guidance to practice and refine your own answers.',
  },
] as const;

/** Matches FAQ on /resume-keyword-optimizer landing page. */
export const RESUME_KEYWORD_OPTIMIZER_LANDING_FAQ_ENTRIES = [
  {
    question: 'What is a resume keyword optimizer?',
    answer:
      'A resume keyword optimizer helps you align your resume language with a specific job description. ResuV compares your resume to the posting and highlights missing keywords, match gaps, and tailoring opportunities so you can improve relevance before applying.',
  },
  {
    question: 'Why do resume keywords matter?',
    answer:
      'Recruiters and ATS tools search for skills, tools, and role-specific terms when reviewing large applicant pools. When your resume lacks the language used in the job description, your experience can be overlooked even if you are qualified.',
  },
  {
    question: 'How does ATS use keywords?',
    answer:
      'Applicant Tracking Systems parse resume text and compare it to job requirements. They may rank candidates by keyword overlap, required skills, and formatting quality. ResuV helps you see how your resume may be interpreted in similar screening workflows.',
  },
  {
    question: 'Can ResuV find missing keywords?',
    answer:
      'Yes. When you run a resume analysis with a job description, ResuV reports missing keywords and related match insights as part of your personalized feedback.',
  },
  {
    question: 'Should I stuff keywords into my resume?',
    answer:
      'No. Keyword stuffing can read unnaturally and hurt credibility. ResuV suggests terms to add only where they accurately reflect your real experience and achievements.',
  },
  {
    question: 'How do I optimize keywords for a specific job?',
    answer:
      'Upload your resume, paste the job description, and review the missing keywords and improvement suggestions in your ResuV report. Tailor bullets and skills sections for each role you apply to.',
  },
  {
    question: 'Is keyword optimization free on ResuV?',
    answer:
      'ResuV offers a free tier with resume analysis that includes keyword and ATS feedback. Pro plans unlock additional usage and full report access. Visit our Pricing page for current plan details.',
  },
] as const;

/** Matches FAQ on /resume-score-checker landing page. */
export const RESUME_SCORE_CHECKER_LANDING_FAQ_ENTRIES = [
  {
    question: 'What is a resume score checker?',
    answer:
      'A resume score checker evaluates how strong your resume is for a specific job—often using scores such as ATS compatibility and job match. ResuV provides these scores along with detailed feedback so you know what to improve before applying.',
  },
  {
    question: 'What does ATS compatibility score mean?',
    answer:
      'ATS compatibility reflects how well your resume is likely to be parsed and ranked by Applicant Tracking Systems. ResuV considers structure, formatting signals, and content clarity to estimate screening performance.',
  },
  {
    question: 'What is job match score?',
    answer:
      'Job match score shows how closely your resume aligns with the requirements and language in a job description. A higher match generally means your skills and experience are easier for recruiters and ATS tools to connect to the role.',
  },
  {
    question: 'How does ResuV calculate resume scores?',
    answer:
      'ResuV uses AI to compare your resume against the job description you provide, reviewing keywords, section quality, strengths, gaps, and formatting factors. Scores are estimates meant to guide improvements—not guarantees of hiring outcomes.',
  },
  {
    question: 'Can I improve my resume score?',
    answer:
      'Yes. ResuV includes actionable improvement suggestions. Tailor keywords, strengthen bullets, fix formatting issues, and re-run the analyzer to track how your ATS and job match scores change.',
  },
  {
    question: 'How accurate is resume scoring?',
    answer:
      'Accuracy depends on the completeness of your resume text and job description. ResuV provides detailed, role-specific feedback, but you should review suggestions and apply only changes that reflect your real experience.',
  },
  {
    question: 'Is resume scoring free on ResuV?',
    answer:
      'ResuV offers a free tier with resume analysis that includes scoring and feedback. Pro plans unlock additional usage and full report access. Visit our Pricing page for current plan details.',
  },
] as const;

/** Matches FAQ on /resume-feedback landing page. */
export const RESUME_FEEDBACK_LANDING_FAQ_ENTRIES = [
  {
    question: 'What is professional resume feedback?',
    answer:
      'Professional resume feedback is structured guidance on how to improve your resume for a specific job—covering clarity, relevance, keywords, formatting, and impact. ResuV provides AI-powered feedback so you can refine your application before submitting.',
  },
  {
    question: 'How is AI resume feedback different from generic tips?',
    answer:
      'Generic resume advice applies to everyone. ResuV compares your resume to the job description you provide and returns role-specific strengths, weaknesses, missing keywords, and improvement suggestions tailored to that posting.',
  },
  {
    question: 'What common resume weaknesses does ResuV identify?',
    answer:
      'ResuV can flag vague bullets, missing keywords, weak sections, formatting risks, and gaps between your resume and the job requirements. Your report explains what to fix and why it matters for screening and recruiter review.',
  },
  {
    question: 'Does ResuV replace a human resume reviewer?',
    answer:
      'ResuV is a fast, scalable first pass—not a substitute for mentors, career coaches, or recruiters. It helps you catch issues early and arrive at human review with a stronger, more targeted resume.',
  },
  {
    question: 'Is my resume stored when I get feedback?',
    answer:
      'When you are signed in, ResuV can save analysis history to your account so you can revisit feedback from your dashboard. See our Privacy Policy for how data is handled.',
  },
  {
    question: 'Can I get feedback on multiple versions?',
    answer:
      'Yes. Signed-in users can run additional analyses and compare feedback over time as they tailor resumes for different roles, subject to plan limits.',
  },
  {
    question: 'Is resume feedback free on ResuV?',
    answer:
      'ResuV offers a free tier with resume analysis and feedback features. Pro plans unlock additional usage and full report access. Visit our Pricing page for current plan details.',
  },
] as const;

/** Global schemas rendered once in index.html — referenced by @id elsewhere. */
export function buildGlobalStructuredDataGraph(): Record<string, unknown>[] {
  return [
    {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: SEO_SITE_NAME,
      url: SEO_SITE_URL,
      logo: SEO_LOGO_URL,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: SUPPORT_EMAIL,
        availableLanguage: 'English',
      },
    },
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: SEO_SITE_NAME,
      url: SEO_SITE_URL,
      description: SEO_DEFAULT_DESCRIPTION,
      publisher: { '@id': ORGANIZATION_ID },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': SOFTWARE_APPLICATION_ID,
      name: SEO_SITE_NAME,
      url: SEO_SITE_URL,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: SEO_DEFAULT_DESCRIPTION,
      image: SEO_OG_IMAGE_URL,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      provider: { '@id': ORGANIZATION_ID },
    },
  ];
}

function buildWebPageSchema(meta: PageSeoMeta): Record<string, unknown> {
  const url = seoCanonicalUrl(meta.canonicalPath);
  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    name: meta.title,
    url,
    description: meta.description,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': SOFTWARE_APPLICATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
  };
}

function buildFaqPageSchema(): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    '@id': `${seoCanonicalUrl('/pricing')}#faq`,
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity: PRICING_FAQ_ENTRIES.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };
}

function buildResumeAnalyzerLandingFaqSchema(): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    '@id': `${seoCanonicalUrl('/resume-analyzer')}#faq`,
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity: RESUME_ANALYZER_LANDING_FAQ_ENTRIES.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };
}

function buildResumeAnalyzerBreadcrumbSchema(): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${seoCanonicalUrl('/resume-analyzer')}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: seoCanonicalUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'AI Resume Analyzer',
        item: seoCanonicalUrl('/resume-analyzer'),
      },
    ],
  };
}

function buildInterviewPrepLandingFaqSchema(): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    '@id': `${seoCanonicalUrl('/ai-interview-preparation')}#faq`,
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity: INTERVIEW_PREP_LANDING_FAQ_ENTRIES.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };
}

function buildInterviewPrepLandingBreadcrumbSchema(): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${seoCanonicalUrl('/ai-interview-preparation')}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: seoCanonicalUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'AI Interview Preparation',
        item: seoCanonicalUrl('/ai-interview-preparation'),
      },
    ],
  };
}

function buildResumeKeywordOptimizerLandingFaqSchema(): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    '@id': `${seoCanonicalUrl('/resume-keyword-optimizer')}#faq`,
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity: RESUME_KEYWORD_OPTIMIZER_LANDING_FAQ_ENTRIES.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };
}

function buildResumeKeywordOptimizerBreadcrumbSchema(): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${seoCanonicalUrl('/resume-keyword-optimizer')}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: seoCanonicalUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Resume Keyword Optimizer',
        item: seoCanonicalUrl('/resume-keyword-optimizer'),
      },
    ],
  };
}

function buildResumeScoreCheckerLandingFaqSchema(): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    '@id': `${seoCanonicalUrl('/resume-score-checker')}#faq`,
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity: RESUME_SCORE_CHECKER_LANDING_FAQ_ENTRIES.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };
}

function buildResumeScoreCheckerBreadcrumbSchema(): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${seoCanonicalUrl('/resume-score-checker')}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: seoCanonicalUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Resume Score Checker',
        item: seoCanonicalUrl('/resume-score-checker'),
      },
    ],
  };
}

function buildResumeFeedbackLandingFaqSchema(): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    '@id': `${seoCanonicalUrl('/resume-feedback')}#faq`,
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity: RESUME_FEEDBACK_LANDING_FAQ_ENTRIES.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };
}

function buildResumeFeedbackBreadcrumbSchema(): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${seoCanonicalUrl('/resume-feedback')}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: seoCanonicalUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Resume Feedback',
        item: seoCanonicalUrl('/resume-feedback'),
      },
    ],
  };
}

const NOINDEX_PAGE_KEYS = new Set<SeoPageKey>([
  'dashboard',
  'analyzer',
  'interview',
  'interview-prep',
  'payment-success',
  'check-email',
  'reset-password',
]);

/** Per-route schemas injected client-side (WebPage + optional FAQPage). */
export function buildPageStructuredDataGraph(
  page: string,
  meta: PageSeoMeta,
): Record<string, unknown>[] {
  const pageKey = page as SeoPageKey;
  if (NOINDEX_PAGE_KEYS.has(pageKey) || meta.noindex) {
    return [];
  }

  const graph: Record<string, unknown>[] = [buildWebPageSchema(meta)];

  if (pageKey === 'pricing') {
    graph.push(buildFaqPageSchema());
  }

  if (pageKey === 'resume-analyzer') {
    graph.push(buildResumeAnalyzerLandingFaqSchema());
    graph.push(buildResumeAnalyzerBreadcrumbSchema());
  }

  if (pageKey === 'ai-interview-preparation') {
    graph.push(buildInterviewPrepLandingFaqSchema());
    graph.push(buildInterviewPrepLandingBreadcrumbSchema());
  }

  if (pageKey === 'resume-keyword-optimizer') {
    graph.push(buildResumeKeywordOptimizerLandingFaqSchema());
    graph.push(buildResumeKeywordOptimizerBreadcrumbSchema());
  }

  if (pageKey === 'resume-score-checker') {
    graph.push(buildResumeScoreCheckerLandingFaqSchema());
    graph.push(buildResumeScoreCheckerBreadcrumbSchema());
  }

  if (pageKey === 'resume-feedback') {
    graph.push(buildResumeFeedbackLandingFaqSchema());
    graph.push(buildResumeFeedbackBreadcrumbSchema());
  }

  return graph;
}

export function serializeStructuredDataGraph(graph: Record<string, unknown>[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': graph,
  });
}
