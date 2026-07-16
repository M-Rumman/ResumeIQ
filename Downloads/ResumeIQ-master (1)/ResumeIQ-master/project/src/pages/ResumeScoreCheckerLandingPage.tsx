import { useState } from 'react';
import {
  ArrowRight,
  Upload,
  FileText,
  Target,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  ChevronDown,
  BarChart3,
  AlertTriangle,
  Zap,
  ListChecks,
  Search,
} from 'lucide-react';
import ScrollReveal from '../components/ScrollReveal';
import ResumeScoreCheckerLandingPreview from '../components/landing/ResumeScoreCheckerLandingPreview';

interface ResumeScoreCheckerLandingPageProps {
  onNavigate: (page: string) => void;
}

const SCORE_TYPES = [
  {
    icon: Target,
    title: 'ATS Compatibility Score',
    text: 'Estimates how well your resume is likely to perform in Applicant Tracking System screening—based on structure, formatting signals, and parse-friendly content.',
  },
  {
    icon: Zap,
    title: 'Job Match Score',
    text: 'Measures how closely your resume aligns with the skills, requirements, and language in a specific job description.',
  },
];

const QUALITY_FACTORS = [
  {
    icon: Search,
    title: 'Keyword alignment',
    text: 'Whether important terms from the job description appear clearly in your resume.',
  },
  {
    icon: FileText,
    title: 'Structure and sections',
    text: 'Clear headings, logical order, and content that automated parsers can read reliably.',
  },
  {
    icon: ListChecks,
    title: 'Achievement clarity',
    text: 'Bullets that show outcomes and impact—not just responsibilities without context.',
  },
  {
    icon: AlertTriangle,
    title: 'Formatting risks',
    text: 'Layouts, tables, or dense blocks that may cause parsing errors in ATS workflows.',
  },
];

const AI_EVALUATION_POINTS = [
  'Compares your resume text to the job description you provide',
  'Reviews ATS-friendly structure and section organization',
  'Identifies missing keywords and relevance gaps',
  'Highlights strengths already working in your favor',
  'Surfaces weak sections that may lower perceived fit',
  'Generates actionable improvement suggestions you can apply',
];

const IMPROVE_STEPS = [
  {
    step: 1,
    title: 'Run your baseline score',
    text: 'Upload or paste your resume and add the target job description to see your ATS and job match scores.',
    icon: Upload,
  },
  {
    step: 2,
    title: 'Review score breakdown',
    text: 'Understand which factors are helping or hurting your compatibility and match percentages.',
    icon: BarChart3,
  },
  {
    step: 3,
    title: 'Address missing keywords and gaps',
    text: 'Add role-specific language where it truthfully reflects your experience.',
    icon: Target,
  },
  {
    step: 4,
    title: 'Re-analyze and track progress',
    text: 'Apply suggestions, then run another analysis to see how your scores improve over time.',
    icon: CheckCircle2,
  },
];

const REPORT_FEATURES = [
  {
    title: 'ATS Compatibility Score',
    text: 'See how well your resume is likely to perform in automated screening.',
  },
  {
    title: 'Job Match Score',
    text: 'Understand how closely your background aligns with a specific posting.',
  },
  {
    title: 'Missing Keywords',
    text: 'Identify important terms from the job description not reflected in your resume.',
  },
  {
    title: 'Resume Strengths',
    text: 'Learn what is already working so you can lead with your strongest points.',
  },
  {
    title: 'Weak Sections',
    text: 'Spot gaps in structure, clarity, or content that may hold your application back.',
  },
  {
    title: 'Actionable Improvements',
    text: 'Receive specific suggestions for bullets, formatting, and keyword placement.',
  },
];

const COMMON_MISTAKES = [
  'Submitting without checking ATS compatibility',
  'Ignoring job match score for each application',
  'Using one generic resume for every role',
  'Weak bullets with no measurable outcomes',
  'Formatting that breaks automated parsing',
  'Skipping a second analysis after making edits',
];

const FAQ_ITEMS = [
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
];

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `resume-score-checker-faq-panel-${index}`;
        const buttonId = `resume-score-checker-faq-button-${index}`;

        return (
          <div key={item.question} className="glass-card-solid overflow-hidden">
            <h3 className="m-0">
              <button
                type="button"
                id={buttonId}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left font-bold text-primary hover:bg-white/40 transition-colors"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                <span>{item.question}</span>
                <ChevronDown
                  className={`w-5 h-5 flex-shrink-0 text-accent transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="px-5 pb-4 text-sm text-body leading-relaxed"
            >
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ResumeScoreCheckerLandingPage({ onNavigate }: ResumeScoreCheckerLandingPageProps) {
  function scrollToPreview() {
    document.getElementById('resume-score-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-screen">
      <section className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <ScrollReveal>
              <p className="section-label mb-3">Resume Score Checker</p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl text-primary leading-tight mb-5">
                Resume Score Checker
              </h1>
              <p className="text-lg text-body leading-relaxed max-w-xl mb-8">
                Understand what your resume score means, see how AI evaluates quality, and learn how to improve
                your ATS compatibility and job match before you apply.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={() => onNavigate('analyzer')} className="btn-primary btn-cta">
                  Check My Resume Score
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button type="button" onClick={scrollToPreview} className="btn-ghost">
                  View Score Overview
                </button>
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <div id="resume-score-preview">
                <ResumeScoreCheckerLandingPreview />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl text-primary mb-6">What Does a Resume Score Mean?</h2>
            <div className="space-y-4 text-body leading-relaxed">
              <p>
                A resume score is a structured way to measure how ready your resume is for a specific job.
                Instead of guessing whether your application is competitive, scores summarize key signals—such
                as ATS compatibility and alignment with the job description—in numbers you can track over time.
              </p>
              <p>
                Scores are not a hiring decision. Employers weigh interviews, culture fit, and many other
                factors. But when hundreds of applicants apply to the same role, automated screening and quick
                recruiter scans often happen first. A stronger score usually means your resume is easier to
                parse, search, and match to the posting.
              </p>
              <p>
                ResuV provides ATS Compatibility and Job Match scores as part of every analysis, along with
                explanations and improvement guidance so you know what to fix—not just what number you received.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl text-primary mb-3">Types of Scores on ResuV</h2>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {SCORE_TYPES.map(({ icon: Icon, title, text }) => (
              <ScrollReveal key={title}>
                <div className="glass-card glass-card-interactive p-6 h-full">
                  <Icon className="w-8 h-8 text-accent mb-4" aria-hidden />
                  <h3 className="font-bold text-primary mb-2">{title}</h3>
                  <p className="text-sm text-body leading-relaxed">{text}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl text-primary mb-6">How AI Evaluates Resumes</h2>
            <div className="space-y-4 text-body leading-relaxed mb-8">
              <p>
                ResuV uses AI to review your resume in context—against the job description you provide—not in
                isolation. That matters because a resume that looks strong generically may still score low for a
                specific role if key requirements are missing or hard to find.
              </p>
              <p>
                The evaluation considers both automated screening realities and recruiter readability: keywords,
                structure, clarity of achievements, and sections that may confuse parsers or bury important
                skills.
              </p>
            </div>
            <ul className="space-y-3">
              {AI_EVALUATION_POINTS.map((item) => (
                <li key={item} className="flex gap-3 items-start glass-card-solid px-4 py-3">
                  <Sparkles className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" aria-hidden />
                  <span className="text-body text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl text-primary mb-3">What Affects Resume Quality</h2>
            <p className="text-body max-w-2xl mx-auto">
              These factors influence both ATS compatibility and job match scores on ResuV.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-6">
            {QUALITY_FACTORS.map(({ icon: Icon, title, text }) => (
              <ScrollReveal key={title}>
                <div className="glass-card p-6 h-full">
                  <div className="w-10 h-10 neu-surface rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-accent" aria-hidden />
                  </div>
                  <h3 className="font-bold text-primary mb-2">{title}</h3>
                  <p className="text-sm text-body leading-relaxed">{text}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl text-primary mb-3">How to Improve Your Score with ResuV</h2>
          </ScrollReveal>
          <ol className="space-y-6">
            {IMPROVE_STEPS.map(({ step, title, text, icon: Icon }) => (
              <ScrollReveal key={step}>
                <li className="glass-card-solid p-6 flex gap-5 items-start">
                  <div className="w-12 h-12 neu-surface rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-accent" aria-hidden />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-accent mb-1">Step {step}</p>
                    <h3 className="text-lg font-bold text-primary mb-2">{title}</h3>
                    <p className="text-sm text-body leading-relaxed">{text}</p>
                  </div>
                </li>
              </ScrollReveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl text-primary mb-3">What Your Report Includes</h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {REPORT_FEATURES.map(({ title, text }) => (
              <ScrollReveal key={title}>
                <div className="glass-card p-6 h-full">
                  <BarChart3 className="w-6 h-6 text-accent mb-3" aria-hidden />
                  <h3 className="font-bold text-primary mb-2">{title}</h3>
                  <p className="text-sm text-body leading-relaxed">{text}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl text-primary mb-8">Common Mistakes That Lower Scores</h2>
            <ul className="space-y-3">
              {COMMON_MISTAKES.map((item) => (
                <li key={item} className="flex gap-3 items-start glass-card-solid px-4 py-3">
                  <AlertTriangle className="w-5 h-5 text-cta flex-shrink-0 mt-0.5" aria-hidden />
                  <span className="text-body">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-body mt-8">
              Explore our{' '}
              <button
                type="button"
                onClick={() => onNavigate('resume-analyzer')}
                className="text-[#3c4a59] font-semibold hover:underline"
              >
                AI Resume Analyzer
              </button>
              , optimize keywords with the{' '}
              <button
                type="button"
                onClick={() => onNavigate('resume-keyword-optimizer')}
                className="text-[#3c4a59] font-semibold hover:underline"
              >
                Resume Keyword Optimizer
              </button>
              , or view{' '}
              <button type="button" onClick={() => onNavigate('pricing')} className="text-[#3c4a59] font-semibold hover:underline">
                ResuV pricing
              </button>
              .
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white/30" aria-labelledby="resume-score-checker-faq-heading">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 id="resume-score-checker-faq-heading" className="text-3xl text-primary mb-8 text-center">
              Frequently Asked Questions
            </h2>
            <FaqAccordion />
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="glass-modal p-10 sm:p-12 text-center">
              <TrendingUp className="w-10 h-10 text-accent mx-auto mb-4" aria-hidden />
              <h2 className="text-3xl font-extrabold text-primary mb-4">Ready to Check Your Resume Score?</h2>
              <p className="text-body mb-8 max-w-lg mx-auto">
                Run a free AI resume analysis on ResuV and see your ATS compatibility and job match scores with
                actionable feedback.
              </p>
              <button type="button" onClick={() => onNavigate('analyzer')} className="btn-primary btn-cta">
                Analyze Resume Now
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="mt-6 text-sm text-primary">
                <button type="button" onClick={() => onNavigate('home')} className="font-semibold hover:underline">
                  Return to ResuV home
                </button>
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
