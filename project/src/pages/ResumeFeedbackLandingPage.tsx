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
  AlertTriangle,
  MessageSquare,
  ListChecks,
  Users,
  Search,
} from 'lucide-react';
import ScrollReveal from '../components/ScrollReveal';
import ResumeFeedbackLandingPreview from '../components/landing/ResumeFeedbackLandingPreview';

interface ResumeFeedbackLandingPageProps {
  onNavigate: (page: string) => void;
}

const FEEDBACK_VALUE_CARDS = [
  {
    icon: Users,
    title: 'Recruiters scan quickly',
    text: 'Most reviewers spend only seconds on an initial pass. Clear feedback helps you fix what they notice first—structure, relevance, and impact.',
  },
  {
    icon: Search,
    title: 'ATS reads before humans',
    text: 'Automated screening may filter applications before a person opens your file. Feedback that addresses parsing and keywords reduces early rejection risk.',
  },
  {
    icon: Target,
    title: 'Roles differ',
    text: 'Feedback tied to a specific job description is more useful than generic resume tips. Tailoring language and emphasis matters for each application.',
  },
  {
    icon: MessageSquare,
    title: 'Blind spots are common',
    text: 'Candidates often miss weak bullets, missing skills, or formatting issues they have read dozens of times. A structured review surfaces those gaps.',
  },
];

const COMMON_WEAKNESSES = [
  'Generic summary with no role-specific focus',
  'Bullets that list duties without measurable results',
  'Missing keywords from the job description',
  'Poor formatting that breaks ATS parsing',
  'Skills section that does not match the posting',
  'Irrelevant detail crowding out key experience',
  'Unclear job titles or employment gaps without context',
  'No alignment between resume and target seniority level',
];

const AI_REVIEW_POINTS = [
  'Compares your resume text to the job description you provide',
  'Highlights resume strengths worth leading with in applications',
  'Flags weak sections that may reduce clarity or relevance',
  'Identifies missing keywords and match gaps for the role',
  'Provides ATS compatibility and job match perspective',
  'Delivers actionable improvement suggestions you can apply yourself',
];

const FEEDBACK_STEPS = [
  {
    step: 1,
    title: 'Submit your resume',
    text: 'Paste your resume text or upload a PDF or DOCX file to begin.',
    icon: Upload,
  },
  {
    step: 2,
    title: 'Add the job description',
    text: 'Include the target role so feedback reflects real requirements—not generic advice.',
    icon: FileText,
  },
  {
    step: 3,
    title: 'Receive AI-powered review',
    text: 'ResuV analyzes structure, keywords, strengths, gaps, and alignment with the posting.',
    icon: Sparkles,
  },
  {
    step: 4,
    title: 'Apply improvements',
    text: 'Use specific suggestions to revise bullets, keywords, and sections—then re-analyze to track progress.',
    icon: CheckCircle2,
  },
];

const FEEDBACK_FEATURES = [
  {
    title: 'Resume Strengths',
    text: 'Understand what is already working so you can lead with your strongest points.',
  },
  {
    title: 'Actionable Improvements',
    text: 'Receive specific suggestions for bullets, formatting, and keyword placement.',
  },
  {
    title: 'Weak Sections',
    text: 'Spot gaps in structure, clarity, or content that may hold your application back.',
  },
  {
    title: 'Missing Keywords',
    text: 'Identify important terms from the job description not reflected in your resume.',
  },
  {
    title: 'ATS Compatibility Score',
    text: 'See how well your resume is likely to perform in automated screening.',
  },
  {
    title: 'Job Match Insights',
    text: 'Compare your background to the role requirements with a focused match perspective.',
  },
];

const FAQ_ITEMS = [
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
];

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `resume-feedback-faq-panel-${index}`;
        const buttonId = `resume-feedback-faq-button-${index}`;

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

export default function ResumeFeedbackLandingPage({ onNavigate }: ResumeFeedbackLandingPageProps) {
  function scrollToPreview() {
    document.getElementById('resume-feedback-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-screen">
      <section className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <ScrollReveal>
              <p className="section-label mb-3">Resume Feedback</p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl text-primary leading-tight mb-5">
                Resume Feedback
              </h1>
              <p className="text-lg text-body leading-relaxed max-w-xl mb-8">
                Get professional resume feedback powered by AI—identify weaknesses, understand what
                recruiters look for, and improve your resume before you apply.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={() => onNavigate('analyzer')} className="btn-primary btn-cta">
                  Get Resume Feedback Free
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button type="button" onClick={scrollToPreview} className="btn-ghost">
                  View Feedback Overview
                </button>
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <div id="resume-feedback-preview">
                <ResumeFeedbackLandingPreview />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl text-primary mb-6">What Is Professional Resume Feedback?</h2>
            <div className="space-y-4 text-body leading-relaxed">
              <p>
                Professional resume feedback tells you what is working, what is not, and what to change
                before you submit an application. Unlike a quick spell-check, good feedback focuses on
                relevance—how clearly your experience maps to the role, whether key skills are easy to
                find, and whether your resume will survive automated screening.
              </p>
              <p>
                Traditional feedback might come from a mentor, career center, or paid reviewer. Those
                sources can be valuable but are often slow, expensive, or not tailored to each job
                posting. AI-powered resume reviews complement that process by giving you fast,
                job-specific guidance you can act on immediately.
              </p>
              <p>
                ResuV analyzes your resume against the job description you provide and returns structured
                feedback: strengths, improvements, weak sections, missing keywords, and scores that reflect
                ATS compatibility and job match. You stay in control of every edit while using clear
                recommendations to strengthen each application.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl text-primary mb-3">Why Resume Feedback Matters</h2>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-6">
            {FEEDBACK_VALUE_CARDS.map(({ icon: Icon, title, text }) => (
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

      <section className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl text-primary mb-8">Common Resume Weaknesses</h2>
            <ul className="space-y-3">
              {COMMON_WEAKNESSES.map((item) => (
                <li key={item} className="flex gap-3 items-start glass-card-solid px-4 py-3">
                  <AlertTriangle className="w-5 h-5 text-cta flex-shrink-0 mt-0.5" aria-hidden />
                  <span className="text-body">{item}</span>
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl text-primary mb-6">AI-Powered Resume Reviews</h2>
            <div className="space-y-4 text-body leading-relaxed mb-8">
              <p>
                ResuV uses artificial intelligence to review your resume in the context of a real job
                description. The review is not a generic template—it reflects the skills, keywords, and
                requirements emphasized in the posting you are targeting.
              </p>
              <p>
                AI feedback helps you move faster than waiting for manual review alone. You can iterate:
                run an analysis, apply suggestions, and analyze again to see how your resume improves for
                that role.
              </p>
            </div>
            <ul className="space-y-3">
              {AI_REVIEW_POINTS.map((item) => (
                <li key={item} className="flex gap-3 items-start glass-card-solid px-4 py-3">
                  <Sparkles className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" aria-hidden />
                  <span className="text-body text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl text-primary mb-3">How to Get Feedback on ResuV</h2>
          </ScrollReveal>
          <ol className="space-y-6">
            {FEEDBACK_STEPS.map(({ step, title, text, icon: Icon }) => (
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
            <h2 className="text-3xl text-primary mb-3">What Your Feedback Report Includes</h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEEDBACK_FEATURES.map(({ title, text }) => (
              <ScrollReveal key={title}>
                <div className="glass-card p-6 h-full">
                  <ListChecks className="w-6 h-6 text-accent mb-3" aria-hidden />
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
            <h2 className="text-3xl text-primary mb-6">Improve Your Resume with ResuV</h2>
            <div className="space-y-4 text-body leading-relaxed">
              <p>
                Effective resume feedback should lead to action. ResuV pairs critique with concrete
                suggestions—so you know not only that a section is weak, but how to strengthen it for the
                role you want.
              </p>
              <p>
                Start with one target job, apply the highest-impact changes first, and re-run the analyzer
                to confirm your ATS compatibility and job match scores improve. Combine feedback with our{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('resume-keyword-optimizer')}
                  className="text-[#3c4a59] font-semibold hover:underline"
                >
                  keyword optimizer
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('resume-score-checker')}
                  className="text-[#3c4a59] font-semibold hover:underline"
                >
                  score checker
                </button>{' '}
                guides when you want deeper focus on specific areas.
              </p>
              <p className="text-sm">
                Explore the full{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('resume-analyzer')}
                  className="text-[#3c4a59] font-semibold hover:underline"
                >
                  AI Resume Analyzer
                </button>{' '}
                overview or view{' '}
                <button type="button" onClick={() => onNavigate('pricing')} className="text-[#3c4a59] font-semibold hover:underline">
                  ResuV pricing
                </button>
                .
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white/30" aria-labelledby="resume-feedback-faq-heading">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 id="resume-feedback-faq-heading" className="text-3xl text-primary mb-8 text-center">
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
              <h2 className="text-3xl font-extrabold text-primary mb-4">Ready for Resume Feedback?</h2>
              <p className="text-body mb-8 max-w-lg mx-auto">
                Run a free AI resume review on ResuV and get actionable feedback tailored to your target
                job before your next application.
              </p>
              <button type="button" onClick={() => onNavigate('analyzer')} className="btn-primary btn-cta">
                Get Resume Feedback
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
