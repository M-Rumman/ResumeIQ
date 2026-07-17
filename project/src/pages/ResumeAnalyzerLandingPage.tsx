import { useState } from 'react';
import {
  ArrowRight,
  Upload,
  FileText,
  Target,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Search,
  ListChecks,
  TrendingUp,
  ChevronDown,
} from 'lucide-react';
import ScrollReveal from '../components/ScrollReveal';
import ResumeAnalyzerLandingPreview from '../components/landing/ResumeAnalyzerLandingPreview';

interface ResumeAnalyzerLandingPageProps {
  onNavigate: (page: string) => void;
}

const ATS_REJECTION_CARDS = [
  {
    icon: Search,
    title: 'Applicant Tracking Systems',
    text: 'Many employers use ATS software to filter applications before a recruiter reads them. If your resume is not structured for parsing, it may never reach a human.',
  },
  {
    icon: FileText,
    title: 'Parsing failures',
    text: 'Complex layouts, tables, and graphics can break automated parsers. Important details may be missed even when your experience is strong.',
  },
  {
    icon: Target,
    title: 'Missing keywords',
    text: 'ATS tools compare your resume against the job description. When required skills and terms are absent, your application can rank lower or be filtered out.',
  },
  {
    icon: AlertTriangle,
    title: 'Formatting issues',
    text: 'Inconsistent headings, unconventional section names, and dense blocks of text make it harder for both software and recruiters to scan your resume quickly.',
  },
  {
    icon: ListChecks,
    title: 'Generic resumes',
    text: 'A one-size-fits-all resume rarely aligns with a specific role. Tailoring language and keywords to each job description improves relevance and match scores.',
  },
];

const STEPS = [
  { step: 1, title: 'Upload your resume', text: 'Paste your resume text or upload a PDF or DOCX file.', icon: Upload },
  { step: 2, title: 'Paste the job description', text: 'Add the target role so the analysis can compare your resume to real requirements.', icon: FileText },
  { step: 3, title: 'AI analyzes both', text: 'ResuV reviews structure, keywords, sections, and alignment with the job posting.', icon: Sparkles },
  { step: 4, title: 'Receive detailed recommendations', text: 'Get scores, missing keywords, strengths, and actionable improvements you can apply before you apply.', icon: CheckCircle2 },
];

const ANALYSIS_FEATURES = [
  { title: 'ATS Compatibility Score', text: 'See how well your resume is likely to perform in automated screening.' },
  { title: 'Missing Keywords', text: 'Identify important terms from the job description that are not reflected in your resume.' },
  { title: 'Resume Strengths', text: 'Understand what is already working so you can lead with your strongest points.' },
  { title: 'Weak Sections', text: 'Spot gaps in structure, clarity, or content that may hold your application back.' },
  { title: 'Actionable Improvements', text: 'Receive specific suggestions for bullets, formatting, and keyword placement.' },
  { title: 'Job Match Insights', text: 'Compare your background to the role requirements with a focused match perspective.' },
];

const COMMON_MISTAKES = [
  'Generic resume sent to every opening',
  'Missing keywords from the job description',
  'Poor formatting that breaks ATS parsing',
  'Weak achievement bullets without measurable impact',
  'Irrelevant information crowding out key experience',
  'No clear results or outcomes in work history',
];

const FAQ_ITEMS = [
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
];

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `resume-analyzer-faq-panel-${index}`;
        const buttonId = `resume-analyzer-faq-button-${index}`;

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

export default function ResumeAnalyzerLandingPage({ onNavigate }: ResumeAnalyzerLandingPageProps) {
  function scrollToSample() {
    document.getElementById('sample-analysis')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <ScrollReveal>
              <p className="section-label mb-3">AI Resume Analyzer</p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl text-primary leading-tight mb-5">
                AI Resume Analyzer
              </h1>
              <p className="text-lg text-body leading-relaxed max-w-xl mb-8">
                Analyze your resume with AI, improve ATS compatibility, identify missing keywords, and
                receive actionable suggestions before applying for jobs.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={() => onNavigate('analyzer')} className="btn-primary btn-cta">
                  Analyze My Resume Free
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button type="button" onClick={scrollToSample} className="btn-ghost">
                  View Sample Analysis
                </button>
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <div id="sample-analysis">
                <ResumeAnalyzerLandingPreview />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* What is */}
      <section className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl text-primary mb-6">What is an AI Resume Analyzer?</h2>
            <div className="space-y-4 text-body leading-relaxed">
              <p>
                An AI resume analyzer is a tool that compares your resume to a specific job description and
                explains how likely it is to perform well in modern hiring workflows. Instead of guessing
                whether your resume is &quot;good enough,&quot; you get structured feedback on keywords,
                sections, clarity, and alignment with the role you want.
              </p>
              <p>
                Recruiters and hiring teams often rely on Applicant Tracking Systems (ATS) to manage large
                applicant pools. These systems parse resumes into searchable fields, score relevance, and
                filter candidates before a human reviewer ever opens a file. That means a strong background
                can still be overlooked when formatting, headings, or terminology do not match what the
                system expects.
              </p>
              <p>
                ResuV&apos;s AI resume analyzer is built for that reality. You upload or paste your resume,
                add the job description, and receive feedback focused on ATS compatibility, missing
                keywords, and practical improvements. The goal is not to rewrite your career story for you,
                but to help you present it clearly for both software and recruiters—so more of your
                applications reach the interview stage.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Why ATS rejects */}
      <section className="py-16 lg:py-20 bg-white/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl text-primary mb-3">Why ATS Rejects Resumes</h2>
            <p className="text-body max-w-2xl mx-auto">
              Understanding how automated screening works helps you fix issues before you apply.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ATS_REJECTION_CARDS.map(({ icon: Icon, title, text }) => (
              <ScrollReveal key={title}>
                <div className="glass-card glass-card-interactive p-6 h-full">
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

      {/* How it works */}
      <section className="py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl text-primary mb-3">How ResuV Works</h2>
          </ScrollReveal>
          <ol className="space-y-6">
            {STEPS.map(({ step, title, text, icon: Icon }) => (
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

      {/* What analysis includes */}
      <section className="py-16 lg:py-20 bg-white/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl text-primary mb-3">What the Analysis Includes</h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ANALYSIS_FEATURES.map(({ title, text }) => (
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

      {/* Why it matters */}
      <section className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl text-primary mb-6">Why Resume Analysis Matters</h2>
            <div className="space-y-4 text-body leading-relaxed">
              <p>
                Competitive roles attract large numbers of applicants. Recruiters rarely have time to read
                every resume in depth on the first pass, and ATS tools are often used to narrow the field
                before human review begins.
              </p>
              <p>
                When your resume is not tailored to the job description, important skills and achievements
                can be buried or missed entirely. A focused analysis helps you see what the role emphasizes
                and whether your resume reflects those priorities clearly.
              </p>
              <p>
                Tailoring does not mean exaggerating—it means aligning language, keywords, and structure so
                your real experience is easy to find. That improves your chances of passing automated filters
                and making a strong first impression when a recruiter does read your application.
              </p>
              <p className="text-sm">
                Explore{' '}
                <button type="button" onClick={() => onNavigate('pricing')} className="text-[#3c4a59] font-semibold hover:underline">
                  ResuV pricing
                </button>{' '}
                or pair your resume work with{' '}
                <button type="button" onClick={() => onNavigate('interview')} className="text-[#3c4a59] font-semibold hover:underline">
                  AI interview preparation
                </button>{' '}
                when you are ready for the next step.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Common mistakes */}
      <section className="py-16 lg:py-20 bg-white/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl text-primary mb-8">Common Resume Mistakes</h2>
            <ul className="space-y-3">
              {COMMON_MISTAKES.map((item) => (
                <li key={item} className="flex gap-3 items-start glass-card-solid px-4 py-3">
                  <span className="text-cta font-bold" aria-hidden>
                    ✕
                  </span>
                  <span className="text-body">{item}</span>
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 lg:py-20" aria-labelledby="resume-analyzer-faq-heading">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 id="resume-analyzer-faq-heading" className="text-3xl text-primary mb-8 text-center">
              Frequently Asked Questions
            </h2>
            <FaqAccordion />
          </ScrollReveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="glass-modal p-10 sm:p-12 text-center">
              <TrendingUp className="w-10 h-10 text-accent mx-auto mb-4" aria-hidden />
              <h2 className="text-3xl font-extrabold text-primary mb-4">Ready to Improve Your Resume?</h2>
              <p className="text-body mb-8 max-w-lg mx-auto">
                Run a free AI resume analysis on the ResuV tool and get actionable feedback before your next
                application.
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
