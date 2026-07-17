import {
  NOINDEX_PAGE_KEYS,
  SEO_DEFAULT_DESCRIPTION,
  SEO_OG_IMAGE_URL,
  SEO_SITE_NAME,
  seoCanonicalUrl,
} from './config.js';

export type SeoPageKey =
  | 'home'
  | 'pricing'
  | 'login'
  | 'signup'
  | 'forgot-password'
  | 'reset-password'
  | 'check-email'
  | 'privacy'
  | 'terms'
  | 'contact'
  | 'about'
  | 'refund-policy'
  | 'resume-analyzer'
  | 'resume-keyword-optimizer'
  | 'resume-score-checker'
  | 'resume-feedback'
  | 'ai-interview-preparation'
  | 'analyzer'
  | 'interview'
  | 'interview-prep'
  | 'dashboard'
  | 'payment-success';

export type PageSeoMeta = {
  title: string;
  description: string;
  canonicalPath: string;
  noindex: boolean;
};

const PAGE_SEO: Record<SeoPageKey, PageSeoMeta> = {
  home: {
    title: 'ResuV | AI Resume Optimizer & ATS Resume Checker',
    description: SEO_DEFAULT_DESCRIPTION,
    canonicalPath: '/',
    noindex: false,
  },
  pricing: {
    title: 'Pricing | ResuV',
    description:
      'Compare ResuV free and Pro plans. Unlock unlimited AI resume analysis, ATS optimization, interview prep, and PDF exports.',
    canonicalPath: '/pricing',
    noindex: false,
  },
  login: {
    title: 'Login | ResuV',
    description: 'Sign in to your ResuV account to access resume analysis, interview prep, and your saved reports.',
    canonicalPath: '/login',
    noindex: false,
  },
  signup: {
    title: 'Create Account | ResuV',
    description:
      'Create a free ResuV account. Get AI-powered resume feedback, ATS scoring, and interview preparation tools.',
    canonicalPath: '/signup',
    noindex: false,
  },
  'forgot-password': {
    title: 'Forgot Password | ResuV',
    description: 'Reset your ResuV account password. We will email you a secure link to choose a new password.',
    canonicalPath: '/forgot-password',
    noindex: false,
  },
  'reset-password': {
    title: 'Reset Password | ResuV',
    description: 'Choose a new password for your ResuV account.',
    canonicalPath: '/reset-password',
    noindex: true,
  },
  'check-email': {
    title: 'Check Your Email | ResuV',
    description: 'Verify your email address to activate your ResuV account.',
    canonicalPath: '/check-email',
    noindex: true,
  },
  privacy: {
    title: 'Privacy Policy | ResuV',
    description:
      'Read the ResuV privacy policy. Learn how we collect, use, and protect your data when you use our resume and interview tools.',
    canonicalPath: '/privacy',
    noindex: false,
  },
  terms: {
    title: 'Terms & Conditions | ResuV',
    description:
      'Review the ResuV terms and conditions for using our AI resume optimizer, ATS checker, and interview preparation platform.',
    canonicalPath: '/terms',
    noindex: false,
  },
  contact: {
    title: 'Contact Us | ResuV',
    description:
      'Contact ResuV support for help with accounts, billing, resume analysis, interview prep, and subscription questions.',
    canonicalPath: '/contact',
    noindex: false,
  },
  about: {
    title: 'About | ResuV',
    description:
      'Learn about ResuV — an AI-powered career platform for resume optimization, ATS compatibility, and interview preparation.',
    canonicalPath: '/about',
    noindex: false,
  },
  'refund-policy': {
    title: 'Refund Policy | ResuV',
    description:
      'Read the ResuV refund policy for Pro subscriptions and one-time report unlock purchases processed via Lemon Squeezy.',
    canonicalPath: '/refund-policy',
    noindex: false,
  },
  'resume-analyzer': {
    title: 'AI Resume Analyzer | ATS Resume Checker | ResuV',
    description:
      'Analyze your resume using AI, improve ATS compatibility, identify missing keywords, and receive personalized suggestions before applying for jobs with ResuV.',
    canonicalPath: '/resume-analyzer',
    noindex: false,
  },
  'resume-keyword-optimizer': {
    title: 'Resume Keyword Optimizer | ATS Keyword Checker | ResuV',
    description:
      'Learn why resume keywords matter, how ATS and recruiters search resumes, and how ResuV identifies missing keywords so you can tailor applications before you apply.',
    canonicalPath: '/resume-keyword-optimizer',
    noindex: false,
  },
  'resume-score-checker': {
    title: 'Resume Score Checker | ATS & Job Match Score | ResuV',
    description:
      'Understand what resume scores mean, how AI evaluates your resume, what affects quality, and how to improve your ATS compatibility and job match scores with ResuV.',
    canonicalPath: '/resume-score-checker',
    noindex: false,
  },
  'resume-feedback': {
    title: 'Resume Feedback | AI Resume Review | ResuV',
    description:
      'Get professional resume feedback powered by AI. Learn common resume weaknesses, review ATS compatibility, and improve your resume with actionable ResuV suggestions.',
    canonicalPath: '/resume-feedback',
    noindex: false,
  },
  'ai-interview-preparation': {
    title: 'AI Interview Preparation | AI Mock Interview | ResuV',
    description:
      'Practice interviews using AI, receive personalized feedback, improve communication skills, and prepare confidently for your next job interview.',
    canonicalPath: '/ai-interview-preparation',
    noindex: false,
  },
  analyzer: {
    title: 'Resume Analyzer | ResuV',
    description: 'Analyze your resume with AI for ATS compatibility and job match scoring.',
    canonicalPath: '/analyzer',
    noindex: true,
  },
  interview: {
    title: 'Interview Prep | ResuV',
    description: 'Generate personalized interview questions and preparation guidance with AI.',
    canonicalPath: '/interview',
    noindex: true,
  },
  'interview-prep': {
    title: 'Interview Prep | ResuV',
    description: 'Generate personalized interview questions and preparation guidance with AI.',
    canonicalPath: '/interview-prep',
    noindex: true,
  },
  dashboard: {
    title: 'Dashboard | ResuV',
    description: 'View your ResuV account dashboard, report history, and subscription status.',
    canonicalPath: '/dashboard',
    noindex: true,
  },
  'payment-success': {
    title: 'Payment Successful | ResuV',
    description: 'Your ResuV payment was successful. Your account access will update shortly.',
    canonicalPath: '/',
    noindex: true,
  },
};

export function getPageSeo(page: string): PageSeoMeta {
  const key = page as SeoPageKey;
  if (key in PAGE_SEO) {
    const meta = PAGE_SEO[key];
    return {
      ...meta,
      noindex: meta.noindex || NOINDEX_PAGE_KEYS.has(key),
    };
  }
  return PAGE_SEO.home;
}

export function getOpenGraphPayload(meta: PageSeoMeta) {
  const url = seoCanonicalUrl(meta.canonicalPath);
  return {
    title: meta.title,
    description: meta.description,
    url,
    image: SEO_OG_IMAGE_URL,
    siteName: SEO_SITE_NAME,
    type: 'website',
  };
}

export function getTwitterPayload(meta: PageSeoMeta) {
  const og = getOpenGraphPayload(meta);
  return {
    card: 'summary_large_image',
    title: og.title,
    description: og.description,
    image: og.image,
  };
}
