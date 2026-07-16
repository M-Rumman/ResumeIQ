import { useState } from 'react';
import {
  ArrowRight,
  MessageSquare,
  Sparkles,
  Target,
  AlertTriangle,
  Users,
  Code2,
  Brain,
  Star,
  Mic,
  ListChecks,
  TrendingUp,
  ChevronDown,
  CheckCircle2,
} from 'lucide-react';
import ScrollReveal from '../components/ScrollReveal';
import InterviewPrepLandingPreview from '../components/landing/InterviewPrepLandingPreview';

interface InterviewPrepLandingPageProps {
  onNavigate: (page: string) => void;
}

const WHY_PRACTICE_CARDS = [
  {
    icon: Users,
    title: 'Interviews are high stakes',
    text: 'A strong resume gets you in the room, but how you communicate under pressure often determines whether you advance.',
  },
  {
    icon: Mic,
    title: 'Answers need structure',
    text: 'Rambling responses are hard to follow. Practicing clear, organized answers helps recruiters understand your value quickly.',
  },
  {
    icon: Target,
    title: 'Roles vary widely',
    text: 'Technical, behavioral, and HR screens each test different skills. Preparation should match the interview type you expect.',
  },
  {
    icon: Brain,
    title: 'Confidence comes from repetition',
    text: 'Familiarity with common question patterns reduces anxiety and helps you think clearly when it matters.',
  },
];

const COMMON_MISTAKES = [
  'Answering without a clear structure',
  'Speaking too generally without examples',
  'Ignoring the specific job requirements',
  'Failing to prepare for behavioral questions',
  'Not researching the company or role',
  'Underselling achievements or impact',
];

const PREP_STEPS = [
  {
    step: 1,
    title: 'Enter your target role',
    text: 'Add the job title, experience level, and skills you want to emphasize.',
    icon: Target,
  },
  {
    step: 2,
    title: 'AI generates question sets',
    text: 'Receive HR, technical, and behavioral questions tailored to the role.',
    icon: Sparkles,
  },
  {
    step: 3,
    title: 'Study tips and ideal outlines',
    text: 'Review guidance, STAR tips, communication advice, and preparation suggestions.',
    icon: ListChecks,
  },
  {
    step: 4,
    title: 'Practice before the real interview',
    text: 'Build confidence by rehearsing answers and refining how you present your experience.',
    icon: CheckCircle2,
  },
];

const INTERVIEW_TYPES = [
  {
    icon: Users,
    title: 'HR & screening',
    text: 'Culture fit, motivation, background, and role alignment questions often come first.',
  },
  {
    icon: Code2,
    title: 'Technical',
    text: 'Role-specific skills, problem-solving, and knowledge checks for technical positions.',
  },
  {
    icon: MessageSquare,
    title: 'Behavioral',
    text: 'Past experience questions that look for evidence of how you handle real workplace situations.',
  },
];

const FEATURE_CARDS = [
  {
    title: 'Personalized interview questions',
    text: 'Questions generated for your target role, experience level, and stated skills.',
  },
  {
    title: 'AI-generated feedback',
    text: 'Tips, ideal answer outlines, and follow-up prompts to strengthen your responses.',
  },
  {
    title: 'Industry-specific preparation',
    text: 'Content adapts to the role and focus areas you provide—not generic interview lists.',
  },
  {
    title: 'Confidence building',
    text: 'Structured practice helps you enter interviews with clearer talking points.',
  },
  {
    title: 'Communication improvement',
    text: 'Communication tips and preparation suggestions support clearer, more persuasive answers.',
  },
  {
    title: 'Practice before real interviews',
    text: 'Use ResuV to rehearse while your application and resume work is still fresh.',
  },
];

const BENEFITS = [
  'Prepare question sets aligned to your target job',
  'Review STAR method guidance for behavioral answers',
  'See HR, technical, and behavioral categories in one report',
  'Save prep sessions to your account when signed in',
  'Pair interview practice with resume analysis on ResuV',
];

const FAQ_ITEMS = [
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
];

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `interview-prep-faq-panel-${index}`;
        const buttonId = `interview-prep-faq-button-${index}`;

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

export default function InterviewPrepLandingPage({ onNavigate }: InterviewPrepLandingPageProps) {
  function scrollToPreview() {
    document.getElementById('interview-prep-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-screen">
      <section className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <ScrollReveal>
              <p className="section-label mb-3">AI Interview Preparation</p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl text-primary leading-tight mb-5">
                AI Interview Preparation
              </h1>
              <p className="text-lg text-body leading-relaxed max-w-xl mb-8">
                Practice job interviews with AI, receive structured feedback, improve your answers, and build
                confidence before your next interview.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={() => onNavigate('interview-prep')} className="btn-primary btn-cta">
                  Start Interview Preparation
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button type="button" onClick={scrollToPreview} className="btn-ghost">
                  View Prep Overview
                </button>
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <div id="interview-prep-preview">
                <InterviewPrepLandingPreview />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl text-primary mb-6">What is AI Interview Preparation?</h2>
            <div className="space-y-4 text-body leading-relaxed">
              <p>
                AI interview preparation is a structured way to get ready for job interviews using tools that
                generate role-specific questions, answer guidance, and practice tips. Instead of searching
                generic question lists online, you receive preparation material aligned to the job you are
                targeting.
              </p>
              <p>
                Modern hiring often includes multiple rounds—screening calls, behavioral interviews, and
                sometimes technical assessments. Each stage expects different types of answers. AI preparation
                helps you organize your thinking around those stages before you speak with a recruiter or
                hiring manager.
              </p>
              <p>
                ResuV&apos;s interview preparation feature generates HR, technical, and behavioral question
                sets based on the role and experience level you provide. You also receive tips, ideal answer
                outlines, STAR guidance, and communication suggestions—so you can practice delivering clear,
                relevant responses instead of improvising under pressure.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl text-primary mb-3">Why Interview Practice Matters</h2>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-6">
            {WHY_PRACTICE_CARDS.map(({ icon: Icon, title, text }) => (
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
            <h2 className="text-3xl text-primary mb-8">Common Interview Mistakes</h2>
            <ul className="space-y-3">
              {COMMON_MISTAKES.map((item) => (
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl text-primary mb-3">How ResuV Prepares You</h2>
          </ScrollReveal>
          <ol className="space-y-6">
            {PREP_STEPS.map(({ step, title, text, icon: Icon }) => (
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

      <section className="py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl text-primary mb-3">Types of Interviews</h2>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-6">
            {INTERVIEW_TYPES.map(({ icon: Icon, title, text }) => (
              <ScrollReveal key={title}>
                <div className="glass-card p-6 h-full text-center">
                  <Icon className="w-8 h-8 text-accent mx-auto mb-4" aria-hidden />
                  <h3 className="font-bold text-primary mb-2">{title}</h3>
                  <p className="text-sm text-body leading-relaxed">{text}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl text-primary mb-6">The STAR Method</h2>
            <div className="space-y-4 text-body leading-relaxed">
              <p>
                Behavioral interviews often expect answers framed with the STAR method: Situation, Task, Action,
                and Result. This structure helps you tell concise stories that show how you handled real
                challenges.
              </p>
              <ul className="space-y-3">
                <li>
                  <strong className="text-primary">Situation</strong> — Set the context briefly.
                </li>
                <li>
                  <strong className="text-primary">Task</strong> — Explain your responsibility or goal.
                </li>
                <li>
                  <strong className="text-primary">Action</strong> — Describe what you did.
                </li>
                <li>
                  <strong className="text-primary">Result</strong> — Share the outcome or impact.
                </li>
              </ul>
              <p>
                ResuV includes STAR tips in interview prep reports so you can practice turning experience into
                structured answers before behavioral rounds.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl text-primary mb-3">Benefits of AI Practice</h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {FEATURE_CARDS.map(({ title, text }) => (
              <ScrollReveal key={title}>
                <div className="glass-card p-6 h-full">
                  <Sparkles className="w-6 h-6 text-accent mb-3" aria-hidden />
                  <h3 className="font-bold text-primary mb-2">{title}</h3>
                  <p className="text-sm text-body leading-relaxed">{text}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <ScrollReveal>
            <ul className="max-w-2xl mx-auto space-y-2">
              {BENEFITS.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-body">
                  <Star className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-sm text-body text-center mt-8">
              Strengthen your application with{' '}
              <button type="button" onClick={() => onNavigate('resume-analyzer')} className="text-[#3c4a59] font-semibold hover:underline">
                AI resume analysis
              </button>{' '}
              or view{' '}
              <button type="button" onClick={() => onNavigate('pricing')} className="text-[#3c4a59] font-semibold hover:underline">
                ResuV pricing
              </button>
              .
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white/30" aria-labelledby="interview-prep-faq-heading">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 id="interview-prep-faq-heading" className="text-3xl text-primary mb-8 text-center">
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
              <h2 className="text-3xl font-extrabold text-primary mb-4">Ready for Your Next Interview?</h2>
              <p className="text-body mb-8 max-w-lg mx-auto">
                Start AI interview preparation on ResuV and walk into your next conversation with clearer
                answers and stronger confidence.
              </p>
              <button type="button" onClick={() => onNavigate('interview-prep')} className="btn-primary btn-cta">
                Start Interview Preparation
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
