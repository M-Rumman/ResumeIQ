import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Target,
  Sparkles,
  BarChart3,
  MessageSquare,
  FileText,
  Brain,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import HeroResumeMockup from '../components/HeroResumeMockup';
import ScrollReveal from '../components/ScrollReveal';
import { PAYMENTS_ENABLED } from '../lib/paymentsConfig.js';
import { PRO_SUBSCRIPTION } from '../lib/monetizationConfig.js';
import { supabase } from '../lib/supabase.js';
import { usePaywallCheckout } from '../hooks/usePaywallCheckout';
import { useUserPlan } from '../hooks/useUserPlan';

interface HomePageProps {
  onNavigate: (page: string) => void;
}

export default function HomePage({ onNavigate }: HomePageProps) {
  const [testimonialName, setTestimonialName] = useState('');
  const [testimonial, setTestimonial] = useState('');
  const [testimonialLoading, setTestimonialLoading] = useState(false);
  const [testimonialSubmitted, setTestimonialSubmitted] = useState(false);
  const [testimonialError, setTestimonialError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const checkout = usePaywallCheckout({
    userId,
    reportId: null,
    onRequireAuth: () => onNavigate('login'),
  });

  const { isPro, loading: planLoading } = useUserPlan();
  const proActive = isPro && Boolean(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const canSubmitTestimonial = testimonialName.trim() && testimonial.trim() && !testimonialLoading;

  async function handleTestimonialSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitTestimonial) return;

    setTestimonialLoading(true);
    setTestimonialError(null);
    setTestimonialSubmitted(false);

    const response = await fetch('/api/submit-testimonial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: testimonialName.trim(),
        review: testimonial.trim(),
      }),
    });

    setTestimonialLoading(false);

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setTestimonialError(data.error || 'Unable to submit your testimonial. Please try again in a moment.');
      return;
    }

    setTestimonialSubmitted(true);
    setTestimonialName('');
    setTestimonial('');
  }

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="pt-12 pb-20 lg:pt-16 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="flex flex-col gap-6">
              <h1 className="text-5xl lg:text-7xl leading-[0.95] text-primary">
                Optimize Your
                <br />
                <span className="text-accent">Resume</span>
              </h1>
              <p className="text-lg text-primary leading-relaxed max-w-lg font-body">
                Improve your ATS score, strengthen bullet points, and prepare for interviews with
                smart, role-aware feedback.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button type="button" onClick={() => onNavigate('analyzer')} className="btn-primary">
                  Analyze My Resume
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => onNavigate('interview')} className="btn-ghost">
                  Interview prep
                </button>
              </div>
            </div>
            <HeroResumeMockup />
          </div>
        </div>
      </section>

      {/* Why ResuV */}
      <section className="py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="grid grid-cols-1 md:grid-cols-2 gap-0 overflow-hidden glass-card">
            <div className="flex flex-col justify-center gap-5 p-8 lg:p-10 border-b md:border-b-0 md:border-r border-[rgba(255,255,255,0.35)]">
              <p className="section-label">Why ResuV</p>
              <h2 className="text-4xl lg:text-5xl text-primary">Built for real hiring systems</h2>
              <p className="text-base lg:text-lg leading-relaxed" style={{ color: '#1A2035' }}>
                ResuV helps job seekers create stronger, more professional resumes using smart
                analysis and optimization tools. Instead of guessing what recruiters or ATS systems
                want, users receive feedback, keyword suggestions, improvements, and interview
                preparation tailored to their target role.
              </p>
            </div>
            <div className="neu-surface m-6 md:m-8 flex items-center justify-center p-8 min-h-[220px]">
              <img
                src="/why-resuv-resume.png"
                alt="Optimized resume example"
                loading="lazy"
                decoding="async"
                className="w-full max-w-[200px] sm:max-w-[220px] rounded-[var(--radius-md)] object-contain"
              />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-14">
            <p className="section-label mb-3">Features</p>
            <h2 className="text-4xl lg:text-5xl text-primary">Everything you need to land the job</h2>
            <p className="mt-4 text-lg text-body max-w-xl mx-auto">
              Powerful tools designed to give you a competitive edge in your job search.
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Target, title: 'ATS Optimization', desc: 'Analyze resumes for ATS compatibility and keyword matching.' },
              { icon: Sparkles, title: 'Smart Suggestions', desc: 'Receive stronger bullet points and measurable achievement tips.' },
              { icon: BarChart3, title: 'Job Match Analysis', desc: 'Compare your resume against job descriptions for fit scoring.' },
              { icon: MessageSquare, title: 'Interview Preparation', desc: 'Generate interview questions and personalized preparation tips.' },
            ].map(({ icon: Icon, title, desc }, i) => (
              <ScrollReveal
                key={title}
                className={`glass-card-interactive p-6 ${i % 2 === 0 ? 'glass-card' : 'neu-surface'}`}
              >
                <div className="w-12 h-12 neu-pressed rounded-[var(--radius-md)] flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl text-primary mb-2">{title}</h3>
                <p className="text-sm text-body leading-relaxed">{desc}</p>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-14">
            <p className="section-label mb-3">Process</p>
            <h2 className="text-4xl lg:text-5xl text-primary">How it works</h2>
            <p className="mt-4 text-lg text-body max-w-xl mx-auto">Three simple steps to transform your resume.</p>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: FileText, title: 'Add Your Resume', desc: 'Upload PDF or DOCX, or paste your resume and job description.' },
              { step: '02', icon: Brain, title: 'Smart Analysis', desc: 'We scan your resume against ATS patterns and job descriptions.' },
              { step: '03', icon: TrendingUp, title: 'Get Optimized Results', desc: 'Receive actionable improvements, keywords, and interview tips.' },
            ].map(({ step, icon: Icon, title, desc }) => (
              <ScrollReveal key={step} className="glass-panel glass-card-interactive p-8 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 neu-surface rounded-[var(--radius-lg)] flex items-center justify-center">
                  <Icon className="w-8 h-8 text-accent" />
                </div>
                <span className="section-label">{step}</span>
                <h3 className="text-2xl text-primary">{title}</h3>
                <p className="text-sm text-body leading-relaxed max-w-xs">{desc}</p>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-10">
            <p className="section-label mb-3">Testimonials</p>
            <h2 className="text-4xl text-primary">Share your experience</h2>
          </ScrollReveal>
          <ScrollReveal>
            <form onSubmit={handleTestimonialSubmit} className="glass-card p-6 lg:p-8 flex flex-col gap-4">
              <div>
                <label htmlFor="testimonial-name" className="block text-sm font-bold text-primary mb-2">
                  Your name
                </label>
                <input
                  id="testimonial-name"
                  type="text"
                  value={testimonialName}
                  onChange={(e) => setTestimonialName(e.target.value)}
                  disabled={testimonialLoading}
                  placeholder="Jane Doe"
                  className="input-neu"
                />
              </div>
              <div>
                <label htmlFor="testimonial-feedback" className="block text-sm font-bold text-primary mb-2">
                  Your experience
                </label>
                <textarea
                  id="testimonial-feedback"
                  rows={6}
                  value={testimonial}
                  onChange={(e) => setTestimonial(e.target.value)}
                  disabled={testimonialLoading}
                  placeholder="Tell us how ResuV helped your job search..."
                  className="input-neu resize-y min-h-[160px]"
                  data-clarity-mask="true"
                />
              </div>
              {testimonialError && <p className="text-sm text-center text-cta font-bold">{testimonialError}</p>}
              <button type="submit" disabled={!canSubmitTestimonial} className="btn-primary self-center sm:self-end">
                {testimonialLoading ? 'Submitting...' : 'Submit Testimonial'}
                {!testimonialLoading && <ArrowRight className="w-4 h-4" />}
              </button>
              {testimonialSubmitted && (
                <p className="text-sm text-center text-accent font-bold">Thank you for sharing your experience!</p>
              )}
            </form>
          </ScrollReveal>
        </div>
      </section>

      {/* Pricing / beta notice */}
      <section className="py-16 lg:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {PAYMENTS_ENABLED ? (
            <ScrollReveal className="glass-card p-8 lg:p-10 text-center flex flex-col items-center gap-4">
              <p className="section-label">ResuV Pro</p>
              <h2 className="text-3xl lg:text-4xl text-primary">
                Unlimited analyses, exports, and full history
              </h2>
              <p className="text-base text-primary leading-relaxed max-w-lg">
                {proActive
                  ? 'Your Pro subscription is active — unlimited resume optimization and interview prep.'
                  : `Upgrade to Pro for ${PRO_SUBSCRIPTION.priceDisplay}${PRO_SUBSCRIPTION.period} — unlimited resume optimization and interview prep.`}
              </p>
              {checkout.error && (
                <p className="text-sm text-red-600 font-medium">{checkout.error}</p>
              )}
              <button
                type="button"
                onClick={proActive ? undefined : () => checkout.subscribePro()}
                disabled={proActive || checkout.processing || planLoading}
                className={`btn-primary btn-cta disabled:opacity-60 disabled:cursor-not-allowed ${
                  proActive
                    ? 'ring-2 ring-green-500/30 bg-green-600 hover:bg-green-600'
                    : ''
                }`}
              >
                {!proActive && checkout.processing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : !proActive ? (
                  <Sparkles className="w-4 h-4" />
                ) : null}
                {proActive
                  ? '✓ Pro Plan Active'
                  : `Upgrade to Pro — ${PRO_SUBSCRIPTION.priceDisplay}${PRO_SUBSCRIPTION.period}`}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('pricing')}
                className="text-sm font-semibold text-primary hover:text-accent"
              >
                Compare plans
              </button>
            </ScrollReveal>
          ) : (
            <ScrollReveal className="glass-card p-8 lg:p-10 text-center flex flex-col items-center gap-4">
              <p className="section-label">Public beta</p>
              <h2 className="text-3xl lg:text-4xl text-primary">Pricing isn&apos;t active yet — enjoy everything freely</h2>
              <p className="text-base text-primary leading-relaxed max-w-lg">
                ResuV is in public beta. All features — resume analysis, interview prep, and full
                recommendations — are free with no payment required.
              </p>
            </ScrollReveal>
          )}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 lg:py-20">
        <ScrollReveal className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass-modal p-10 lg:p-12 text-center flex flex-col items-center gap-6">
            <h2 className="text-4xl lg:text-5xl text-primary">Start improving your resume today</h2>
            <p className="text-primary text-lg max-w-lg">
              Join job seekers who use ResuV to stand out to recruiters and ATS systems.
            </p>
            <button type="button" onClick={() => onNavigate('analyzer')} className="btn-primary btn-cta">
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </ScrollReveal>
      </section>

      {/* Resume & Interview Resources */}
      <section className="py-12 border-t border-[rgba(255,255,255,0.35)] bg-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-primary text-sm font-display tracking-[0.03em] mb-8 font-bold uppercase">
              Resume & Interview Resources
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
              <div>
                <a
                  href="/resume-analyzer"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('resume-analyzer');
                  }}
                  className="text-sm text-left text-body hover:text-[#3c4a59] transition-colors font-bold block w-fit"
                >
                  Resume Analyzer
                </a>
                <p className="text-xs text-body mt-2 leading-relaxed">
                  Analyze resumes against job descriptions and identify ATS issues.
                </p>
              </div>
              <div>
                <a
                  href="/resume-keyword-optimizer"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('resume-keyword-optimizer');
                  }}
                  className="text-sm text-left text-body hover:text-[#3c4a59] transition-colors font-bold block w-fit"
                >
                  Resume Keyword Optimizer
                </a>
                <p className="text-xs text-body mt-2 leading-relaxed">
                  Find missing keywords and improve resume relevance for specific jobs.
                </p>
              </div>
              <div>
                <a
                  href="/resume-score-checker"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('resume-score-checker');
                  }}
                  className="text-sm text-left text-body hover:text-[#3c4a59] transition-colors font-bold block w-fit"
                >
                  Resume Score Checker
                </a>
                <p className="text-xs text-body mt-2 leading-relaxed">
                  Get a resume score based on ATS compatibility and job alignment.
                </p>
              </div>
              <div>
                <a
                  href="/resume-feedback"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('resume-feedback');
                  }}
                  className="text-sm text-left text-body hover:text-[#3c4a59] transition-colors font-bold block w-fit"
                >
                  Resume Feedback
                </a>
                <p className="text-xs text-body mt-2 leading-relaxed">
                  Receive detailed feedback on resume structure, content, and effectiveness.
                </p>
              </div>
              <div>
                <a
                  href="/ai-interview-preparation"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('ai-interview-preparation');
                  }}
                  className="text-sm text-left text-body hover:text-[#3c4a59] transition-colors font-bold block w-fit"
                >
                  AI Interview Preparation
                </a>
                <p className="text-xs text-body mt-2 leading-relaxed">
                  Generate role-specific interview questions and practice responses.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
