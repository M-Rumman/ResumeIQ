import { useState } from 'react';
import {
  ArrowRight,
  Upload,
  Target,
  Sparkles,
  CheckCircle2,
  Search,
  ListChecks,
  TrendingUp,
  ChevronDown,
  BarChart3,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import ScrollReveal from '../components/ScrollReveal';
import ResumeKeywordOptimizerLandingPreview from '../components/landing/ResumeKeywordOptimizerLandingPreview';

interface ResumeKeywordOptimizerLandingPageProps {
  onNavigate: (page: string) => void;
}

const WHY_KEYWORDS_CARDS = [
  {
    icon: Filter,
    title: 'ATS filters by relevance',
    text: 'Applicant Tracking Systems rank and filter resumes using terms from the job description. Missing keywords can lower your visibility before a human reviewer sees your application.',
  },
  {
    icon: Search,
    title: 'Recruiters search like ATS',
    text: 'Hiring teams often search internal databases with job titles, skills, and tools. If your resume does not use the same language as the posting, you may not appear in results.',
  },
  {
    icon: Target,
    title: 'Roles have specific language',
    text: 'Two similar job titles can emphasize different skills. Keyword optimization means aligning your resume vocabulary with what that employer actually asked for.',
  },
  {
    icon: ListChecks,
    title: 'Skills must be findable',
    text: 'Experience you have is easy to miss when it is buried in vague bullets. Clear, keyword-rich phrasing helps both software and recruiters spot your fit faster.',
  },
];

const RECRUITER_SEARCH_POINTS = [
  'Job titles and seniority levels',
  'Hard skills and certifications named in the posting',
  'Tools, platforms, and methodologies',
  'Industry terms and acronyms recruiters expect',
  'Location, clearance, or work-authorization keywords when relevant',
];

const ATS_KEYWORD_POINTS = [
  'Parse resume text into searchable fields',
  'Match resume terms against the job description',
  'Score or rank candidates by keyword overlap and context',
  'Filter applicants who fall below relevance thresholds',
  'Surface structured skill lists to recruiters for quick scanning',
];

const RESUV_STEPS = [
  {
    step: 1,
    title: 'Add your resume and job description',
    text: 'Paste or upload your resume, then include the full job posting so ResuV can compare language side by side.',
    icon: Upload,
  },
  {
    step: 2,
    title: 'AI compares terminology',
    text: 'ResuV analyzes how your resume reflects the skills, tools, and requirements emphasized in the role.',
    icon: Sparkles,
  },
  {
    step: 3,
    title: 'See missing keywords',
    text: 'Your report highlights important terms from the job description that are absent or underrepresented in your resume.',
    icon: Target,
  },
  {
    step: 4,
    title: 'Apply tailored improvements',
    text: 'Use actionable suggestions to add keywords naturally—where they truthfully reflect your experience—before you submit.',
    icon: CheckCircle2,
  },
];

const KEYWORD_FEATURES = [
  {
    title: 'Missing Keywords',
    text: 'Identify important terms from the job description that are not reflected in your resume.',
  },
  {
    title: 'ATS Compatibility Score',
    text: 'Understand how well your resume is likely to perform in automated screening workflows.',
  },
  {
    title: 'Job Match Insights',
    text: 'See how your background aligns with the role requirements from a keyword and relevance perspective.',
  },
  {
    title: 'Resume Strengths',
    text: 'Learn which skills and terms you already present clearly so you can lead with them.',
  },
  {
    title: 'Weak Sections',
    text: 'Spot areas where keyword coverage or clarity may be holding your application back.',
  },
  {
    title: 'Actionable Improvements',
    text: 'Receive specific suggestions for bullets, phrasing, and keyword placement you can apply yourself.',
  },
];

const COMMON_MISTAKES = [
  'Using the same resume for every application',
  'Copying job description text verbatim without real experience',
  'Listing skills without context or outcomes',
  'Hiding keywords in images, tables, or headers ATS cannot parse',
  'Using internal company jargon instead of industry-standard terms',
  'Omitting acronyms and tool names recruiters search for',
];

const FAQ_ITEMS = [
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
];

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `resume-keyword-optimizer-faq-panel-${index}`;
        const buttonId = `resume-keyword-optimizer-faq-button-${index}`;

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

export default function ResumeKeywordOptimizerLandingPage({
  onNavigate,
}: ResumeKeywordOptimizerLandingPageProps) {
  function scrollToPreview() {
    document.getElementById('keyword-optimizer-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-screen">
      <section className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <ScrollReveal>
              <p className="section-label mb-3">Resume Keyword Optimizer</p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl text-primary leading-tight mb-5">
                Resume Keyword Optimizer
              </h1>
              <p className="text-lg text-body leading-relaxed max-w-xl mb-8">
                Align your resume with job descriptions, find missing keywords, and improve ATS relevance before
                recruiters search your application.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={() => onNavigate('analyzer')} className="btn-primary btn-cta">
                  Optimize My Resume Keywords
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button type="button" onClick={scrollToPreview} className="btn-ghost">
                  View Keyword Overview
                </button>
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <div id="keyword-optimizer-preview">
                <ResumeKeywordOptimizerLandingPreview />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl text-primary mb-6">Why Resume Keywords Matter</h2>
            <div className="space-y-4 text-body leading-relaxed">
              <p>
                Resume keywords are the skills, tools, job titles, and industry terms that connect your
                experience to a specific role. When those terms appear clearly in your resume, both automated
                systems and human reviewers can quickly see that your background matches what the employer
                asked for.
              </p>
              <p>
                Many candidates focus on formatting and length but overlook language alignment. A resume can
                describe impressive work yet still underperform if it uses different vocabulary than the job
                posting—missing the exact phrases recruiters type into search boxes or that ATS software
                weighs when ranking applicants.
              </p>
              <p>
                Keyword optimization is not about tricking filters. It is about making your real qualifications
                easy to find. ResuV helps you identify gaps between your resume and a target job description so
                you can tailor each application with confidence.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl text-primary mb-3">How Recruiters Search Resumes</h2>
            <p className="text-body max-w-2xl mx-auto">
              Understanding recruiter search behavior helps you choose the right words on your resume.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <ScrollReveal>
              <div className="glass-card p-6 h-full">
                <Search className="w-8 h-8 text-accent mb-4" aria-hidden />
                <p className="text-sm text-body leading-relaxed mb-4">
                  Recruiters often review hundreds of applications per role. To move efficiently, they search
                  applicant databases and ATS views using terms from the job description—skills, certifications,
                  software, and seniority markers.
                </p>
                <p className="text-sm text-body leading-relaxed">
                  If your resume uses non-standard job titles or omits tools listed in the posting, you may not
                  surface in those searches even when your experience fits the role.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <ul className="glass-card-solid p-6 space-y-3 h-full">
                <p className="text-xs font-bold uppercase tracking-wide text-primary mb-2">Common search terms</p>
                {RECRUITER_SEARCH_POINTS.map((item) => (
                  <li key={item} className="flex gap-3 items-start text-sm text-body">
                    <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl text-primary mb-6">How ATS Uses Keywords</h2>
            <div className="space-y-4 text-body leading-relaxed mb-8">
              <p>
                Applicant Tracking Systems are used by most mid-size and large employers to collect, parse, and
                organize applications. After your resume is uploaded, the ATS extracts text into fields such as
                work history, education, and skills—then compares that data to the requirements in the job
                posting.
              </p>
              <p>
                Keyword match is one signal among several, but it is often decisive in early screening. Resumes
                that lack required terminology may receive lower relevance scores or be filtered out before a
                recruiter reviews them manually.
              </p>
            </div>
            <ul className="space-y-3">
              {ATS_KEYWORD_POINTS.map((item) => (
                <li key={item} className="flex gap-3 items-start glass-card-solid px-4 py-3">
                  <Filter className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" aria-hidden />
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
            <h2 className="text-3xl text-primary mb-3">Why Keywords Get Missed</h2>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-6">
            {WHY_KEYWORDS_CARDS.map(({ icon: Icon, title, text }) => (
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl text-primary mb-3">How ResuV Identifies Missing Keywords</h2>
          </ScrollReveal>
          <ol className="space-y-6">
            {RESUV_STEPS.map(({ step, title, text, icon: Icon }) => (
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
            <h2 className="text-3xl text-primary mb-3">Keyword Insights in Your Report</h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {KEYWORD_FEATURES.map(({ title, text }) => (
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
            <h2 className="text-3xl text-primary mb-8">Common Keyword Mistakes</h2>
            <ul className="space-y-3">
              {COMMON_MISTAKES.map((item) => (
                <li key={item} className="flex gap-3 items-start glass-card-solid px-4 py-3">
                  <AlertTriangle className="w-5 h-5 text-cta flex-shrink-0 mt-0.5" aria-hidden />
                  <span className="text-body">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-body mt-8">
              Learn more about full resume analysis on our{' '}
              <button
                type="button"
                onClick={() => onNavigate('resume-analyzer')}
                className="text-[#3c4a59] font-semibold hover:underline"
              >
                AI Resume Analyzer
              </button>{' '}
              page, explore{' '}
              <button type="button" onClick={() => onNavigate('pricing')} className="text-[#3c4a59] font-semibold hover:underline">
                ResuV pricing
              </button>
              , or prepare for interviews with{' '}
              <button
                type="button"
                onClick={() => onNavigate('ai-interview-preparation')}
                className="text-[#3c4a59] font-semibold hover:underline"
              >
                AI interview preparation
              </button>
              .
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white/30" aria-labelledby="resume-keyword-optimizer-faq-heading">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 id="resume-keyword-optimizer-faq-heading" className="text-3xl text-primary mb-8 text-center">
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
              <h2 className="text-3xl font-extrabold text-primary mb-4">Ready to Optimize Your Keywords?</h2>
              <p className="text-body mb-8 max-w-lg mx-auto">
                Run a free AI resume analysis on ResuV, see missing keywords for your target role, and tailor
                your application before you hit submit.
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
