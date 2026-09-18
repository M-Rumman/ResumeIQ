import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  checkFeatureAccess,
  FEATURE_TYPES,
} from '../lib/usageLimits.js';
import UpgradePrompt from '../components/UpgradePrompt';
import PaywallBlurGate from '../components/PaywallBlurGate';
import PaywallCheckoutPreview from '../components/PaywallCheckoutPreview';
import { PAYMENTS_ENABLED } from '../lib/paymentsConfig.js';
import { FREE_DAILY_INTERVIEW_LIMIT } from '../lib/planConfig.js';
import { ApiRequestError } from '../lib/api/client.js';
import { usePaywallAccess } from '../hooks/usePaywallAccess';
import { usePaywallCheckout } from '../hooks/usePaywallCheckout';
import DailyUsageLimitModal from '../components/DailyUsageLimitModal';
import { fetchAiInterviewPrep } from '../lib/api/interviewPrepApi.js';
import { mapAiInterviewToDisplayWithContext } from '../lib/api/mapInterviewAi.js';

// Lucide Icons
import {
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Users,
  Code2,
  Brain,
  Star,
  Mic,
  ListChecks,
  Bot,
  BarChart3,
  PenTool,
  Search,
  Layers,
  Play,
} from 'lucide-react';

// Specialized Interview Suite Components
import InterviewMockSimulator from '../components/interview/InterviewMockSimulator';
import PerformanceAnalyticsView, { type PerformanceMetrics } from '../components/interview/PerformanceAnalyticsView';
import CodingSandboxAndWhiteboard from '../components/interview/CodingSandboxAndWhiteboard';
import StarFrameworkCoach from '../components/interview/StarFrameworkCoach';
import { getGuaranteedQuestions, type QuestionItem } from '../utils/interviewQuestionsData';

interface Question {
  question: string;
  tip: string;
  idealAnswer?: string;
  followUps?: string[];
}

interface InterviewData {
  hr: Question[];
  technical: Question[];
  behavioral: Question[];
  starTips: string[];
  communicationTips?: string[];
  preparationSuggestions?: string[];
}

function AccordionItem({
  question,
  tip,
  idealAnswer,
  followUps,
  index,
}: {
  question: string;
  tip: string;
  idealAnswer?: string;
  followUps?: string[];
  index: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors text-left gap-4"
      >
        <div className="flex items-start gap-3">
          <span className="w-6 h-6 bg-gray-100 text-[#3c4a59] rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            {index + 1}
          </span>
          <span className="font-medium text-gray-900 text-sm">{question}</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-600 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-600 flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 bg-gray-50/80 border-t border-gray-100 space-y-4">
          {idealAnswer && (
            <div className="pt-4">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">Ideal Answer</p>
              <p className="text-sm text-gray-900 leading-relaxed bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                {idealAnswer}
              </p>
            </div>
          )}
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-[#3c4a59] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-800 leading-relaxed">{tip}</p>
          </div>
          {followUps && followUps.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Likely Follow-ups</p>
              <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                {followUps.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface InterviewPrepPageProps {
  onNavigate: (page: string) => void;
}

type ActiveTab =
  | 'mock_interview'
  | 'performance_analytics'
  | 'coding_whiteboard'
  | 'star_coach'
  | 'role_generator';

export default function InterviewPrepPage({ onNavigate }: InterviewPrepPageProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('mock_interview');

  // Shared state across tabs (initialized empty / null)
  const [latestSessionMetrics, setLatestSessionMetrics] = useState<PerformanceMetrics | null>(null);
  const [mockCustomQuestions, setMockCustomQuestions] = useState<
    Array<{
      id: string;
      stage: string;
      question: string;
      tip: string;
      suggestedPoints: string[];
    }>
  >([]);

  // Dynamic Role & Question Generator Filters & State
  const [jobRole, setJobRole] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('mid');
  const [skills, setSkills] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<InterviewData | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [showDailyLimitModal, setShowDailyLimitModal] = useState(false);
  const [usageInfo, setUsageInfo] = useState({
    used: 0,
    limit: FREE_DAILY_INTERVIEW_LIMIT,
    isPro: false,
    loading: true,
  });
  void usageInfo;

  const [reportId, setReportId] = useState<string | null>(null);

  const {
    unlocked: reportUnlocked,
    userId,
    refresh: refreshPaywallAccess,
  } = usePaywallAccess(reportId);

  const paywallCheckout = usePaywallCheckout({
    userId,
    reportId,
  });

  const hasFullAccess = !PAYMENTS_ENABLED || reportUnlocked || Boolean(reportId);

  async function refreshUsageStatus() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUsageInfo({ used: 0, limit: FREE_DAILY_INTERVIEW_LIMIT, isPro: false, loading: false });
      return;
    }

    const access = await checkFeatureAccess(user.id, FEATURE_TYPES.INTERVIEW_PREP);
    setUsageInfo({
      used: access.used,
      limit: access.limit === Infinity ? FREE_DAILY_INTERVIEW_LIMIT : access.limit,
      isPro: access.isPro,
      loading: false,
    });
  }

  // Force clean slate initialization on component mount
  useEffect(() => {
    setLatestSessionMetrics(null);
    try {
      localStorage.removeItem('interview_metrics');
      localStorage.removeItem('interview_session_analytics');
      localStorage.removeItem('latest_interview_metrics');
    } catch {
      // ignore
    }
    refreshUsageStatus();
  }, []);

  async function handleGenerate() {
    if (!jobRole.trim()) return;

    setLoading(true);
    setSaveSuccess(false);
    setSaveError(null);
    setUpgradeMessage(null);
    setResults(null);
    setReportId(null);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      setSaveError('You must be logged in to save interview prep.');
      return;
    }

    const access = await checkFeatureAccess(user.id, FEATURE_TYPES.INTERVIEW_PREP);

    if (access.error) {
      setLoading(false);
      setSaveError(access.error);
      return;
    }
    if (!access.allowed) {
      setLoading(false);
      setShowDailyLimitModal(true);
      return;
    }

    let prepResults: InterviewData;

    try {
      const ai = await fetchAiInterviewPrep(jobRole.trim(), experienceLevel, skills);
      prepResults = mapAiInterviewToDisplayWithContext(
        ai,
        jobRole.trim(),
        experienceLevel,
        skills,
      ) as InterviewData;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 429 && /today's free interview preparation limit/i.test(error.message)) {
        setLoading(false);
        setShowDailyLimitModal(true);
        await refreshUsageStatus();
        return;
      }
      setLoading(false);
      setSaveError(error instanceof Error ? error.message : 'Interview preparation is temporarily unavailable. Please try again in a few moments.');
      await refreshUsageStatus();
      return;
    }

    setLoading(false);

    if (typeof (prepResults as { reportId?: string | null }).reportId === 'string' && (prepResults as { reportId?: string | null }).reportId) {
      setReportId((prepResults as { reportId?: string | null }).reportId ?? null);
    }

    setResults(prepResults);
    setSaveSuccess(true);
    await refreshUsageStatus();
    await refreshPaywallAccess();
    setTimeout(() => {
      document.getElementById('interview-results')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  // Cross-tab triggers
  const handleFinishMockSession = (metrics: PerformanceMetrics) => {
    setLatestSessionMetrics(metrics);
    setActiveTab('performance_analytics');
  };


  const handlePracticeQuestionFromLibrary = (q: QuestionItem) => {
    setMockCustomQuestions([
      {
        id: q.id,
        stage: `1. ${q.title}`,
        question: q.question,
        tip: q.tip,
        suggestedPoints: [q.idealAnswer, ...q.keyCriteria],
      },
    ]);
    setActiveTab('mock_interview');
  };

  const categories = results
    ? [
        {
          id: 'hr',
          label: 'HR Questions',
          icon: Users,
          color: 'text-[#3c4a59]',
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          questions: results.hr,
        },
        {
          id: 'technical',
          label: 'Technical Questions',
          icon: Code2,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          border: 'border-emerald-100',
          questions: results.technical,
        },
        {
          id: 'behavioral',
          label: 'Behavioral Questions',
          icon: Brain,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          border: 'border-amber-100',
          questions: results.behavioral,
        },
      ]
    : [];

  const navTabs = [
    { id: 'mock_interview' as const, label: 'AI Mock Interview', icon: Bot },
    { id: 'performance_analytics' as const, label: 'Instant Analytics', icon: BarChart3 },
    { id: 'coding_whiteboard' as const, label: 'Coding & Whiteboard', icon: PenTool },
    { id: 'star_coach' as const, label: 'STAR Coach', icon: Star },
    { id: 'role_generator' as const, label: 'Dynamic Role & Question Generator', icon: MessageSquare },
  ];

  const guaranteedQuestions = getGuaranteedQuestions({
    industry: selectedTopic,
    difficulty: selectedDifficulty,
    category: selectedCategory,
    searchQuery: searchQuery,
  });

  return (
    <div className="min-h-screen">
      {/* Header Banner */}
      <div className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-[#3c4a59] rounded-2xl flex items-center justify-center shadow-md">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  AI Interview Preparation Suite
                </h1>
                <p className="text-xs sm:text-sm text-gray-700 font-medium">
                  Realistic persona mock interviews, real-time speech analytics, and tailored candidate readiness.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200 shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live AI Engine Active
              </span>
            </div>
          </div>

          {/* Navigation Bar / Mode Switcher */}
          <div className="mt-8 flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-gray-200/60">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-[#3c4a59] text-white shadow-md shadow-gray-300'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* TAB 1: AI MOCK INTERVIEW */}
        {activeTab === 'mock_interview' && (
          <InterviewMockSimulator
            customQuestions={mockCustomQuestions.length > 0 ? mockCustomQuestions : undefined}
            onFinishSession={handleFinishMockSession}
          />
        )}

        {/* TAB 2: INSTANT PERFORMANCE ANALYTICS */}
        {activeTab === 'performance_analytics' && (
          <PerformanceAnalyticsView
            metrics={latestSessionMetrics || undefined}
            onRetry={() => setActiveTab('mock_interview')}
            onNextQuestion={() => setActiveTab('role_generator')}
            onOpenCoach={() => setActiveTab('star_coach')}
          />
        )}

        {/* TAB 3: CODING & SYSTEM DESIGN WHITEBOARD */}
        {activeTab === 'coding_whiteboard' && <CodingSandboxAndWhiteboard />}

        {/* TAB 4: STAR METHODOLOGY COACH */}
        {activeTab === 'star_coach' && <StarFrameworkCoach />}

        {/* TAB 5: DYNAMIC ROLE & QUESTION GENERATOR (CONSOLIDATED) */}
        {activeTab === 'role_generator' && (
          <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
            {/* Header Description */}
            <div className="glass-card p-6 sm:p-8 space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#3c4a59]" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Unified Question Suite & Generator
                </span>
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900">
                Dynamic Role & Question Generator
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">
                Configure tailored interview question sets with dynamic role, category, difficulty, and domain filters. Every matrix combination is guaranteed to yield at least 2 to 3 distinct questions.
              </p>
            </div>

            {/* Comprehensive Filter & Generation Panel */}
            <div className="glass-card glass-card-interactive p-6 sm:p-8 space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Target Job Role */}
                <div>
                  <label htmlFor="job-role" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Target Job Role
                  </label>
                  <input
                    id="job-role"
                    type="text"
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    placeholder="e.g. Frontend Engineer, Fullstack Architect, Data Scientist..."
                    className="w-full px-4 py-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3c4a59] placeholder-gray-400 bg-white transition-all"
                    data-clarity-mask="true"
                  />
                </div>

                {/* Experience Level / Difficulty */}
                <div>
                  <label htmlFor="experience-level" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Experience Level / Difficulty
                  </label>
                  <select
                    id="experience-level"
                    value={experienceLevel}
                    onChange={(e) => {
                      setExperienceLevel(e.target.value);
                      setSelectedDifficulty(e.target.value);
                    }}
                    className="w-full px-4 py-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3c4a59] bg-white"
                  >
                    <option value="entry">Entry / Junior</option>
                    <option value="mid">Mid-Level</option>
                    <option value="senior">Senior / Lead</option>
                    <option value="staff">Staff / Principal</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Category, Topic/Industry, and Skills */}
              <div className="grid sm:grid-cols-3 gap-4">
                {/* Category Filter */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Question Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3c4a59] bg-white"
                  >
                    <option value="all">All Categories</option>
                    <option value="behavioral">Behavioral (STAR)</option>
                    <option value="technical_dsa">DSA & Coding</option>
                    <option value="system_design">System Design</option>
                    <option value="hr_culture">HR & Culture Fit</option>
                    <option value="situational">Situational Leadership</option>
                  </select>
                </div>

                {/* Topic / Industry Filter */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Topic / Industry
                  </label>
                  <select
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3c4a59] bg-white"
                  >
                    <option value="all">All Industries & Topics</option>
                    <option value="tech">Tech & Software</option>
                    <option value="fintech">Fintech & Finance</option>
                    <option value="healthcare">Healthcare & Biotech</option>
                    <option value="general">General Cross-Industry</option>
                  </select>
                </div>

                {/* Key Skills */}
                <div>
                  <label htmlFor="skills" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Key Skills / Focus
                  </label>
                  <input
                    id="skills"
                    type="text"
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="React, TypeScript, Kafka, AWS..."
                    className="w-full px-4 py-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3c4a59] placeholder-gray-400 bg-white"
                    data-clarity-mask="true"
                  />
                </div>
              </div>

              {/* Row 3: Keyword Search & Action Button */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Quick filter questions by keywords (e.g. LCP, Redis, Outage, Cache)..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3c4a59] bg-white"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-gray-600"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!jobRole.trim() || loading}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 font-bold px-6 py-2.5 rounded-xl text-xs transition-all ${
                    jobRole.trim() && !loading
                      ? 'bg-[#3c4a59] text-white hover:bg-[#2e3a47] shadow-md active:scale-95 cursor-pointer'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating AI Prep...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Generate AI Role Questions
                    </>
                  )}
                </button>
              </div>

              {upgradeMessage && (
                <div className="mt-4">
                  <UpgradePrompt
                    message={upgradeMessage}
                    onUpgrade={() => paywallCheckout.subscribePro()}
                  />
                </div>
              )}
              {saveError && (
                <p className="text-xs text-center text-red-600 font-medium">{saveError}</p>
              )}
            </div>

            {/* AI Generated Results (if triggered) */}
            {results && (
              <div id="interview-results" className="space-y-8 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-gray-200" />
                  <h3 className="font-extrabold text-gray-900 text-lg px-4">
                    AI Generated Interview Package for{' '}
                    <span className="text-[#3c4a59]">{jobRole}</span>
                  </h3>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                {saveSuccess && (
                  <p className="text-center text-xs text-emerald-700 font-semibold bg-emerald-50 py-1.5 px-3 rounded-full border border-emerald-200 max-w-md mx-auto">
                    Session saved. Minimum question guarantees enforced across all categories.
                  </p>
                )}

                {!PAYMENTS_ENABLED ? (
                  <div className="space-y-8">
                    <InterviewResultsBody categories={categories} results={results} />
                    <PaywallCheckoutPreview onPricingSoon={() => onNavigate('pricing')} />
                  </div>
                ) : (
                  <>
                    <div id="paywall-free-preview" className="space-y-8">
                      <InterviewResultsPreview categories={categories} results={results} />
                    </div>
                    {hasFullAccess || !reportId ? (
                      <InterviewResultsPremium categories={categories} results={results} />
                    ) : (
                      <PaywallBlurGate
                        unlocked={false}
                        previewPercent={0}
                        reportId={reportId}
                        onUnlockReport={paywallCheckout.unlockReport}
                        onSubscribePro={paywallCheckout.subscribePro}
                      >
                        <InterviewResultsPremium categories={categories} results={results} />
                      </PaywallBlurGate>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Curated Question Matrix with Minimum 2-3 Output Guarantee */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-base">
                    Question Matrix & Practice Triggers
                  </h3>
                  <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100">
                    {guaranteedQuestions.length} Questions (≥ 3 Guaranteed)
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Filters applied: {selectedCategory !== 'all' ? selectedCategory : 'All Types'} · {selectedDifficulty !== 'all' ? selectedDifficulty : 'All Levels'} · {selectedTopic !== 'all' ? selectedTopic : 'All Domains'}
                </p>
              </div>

              <div className="space-y-3">
                {guaranteedQuestions.map((q) => {
                  const isExpanded = expandedQuestionId === q.id;
                  return (
                    <div
                      key={q.id}
                      className="glass-card p-5 space-y-3 border border-gray-200/80 hover:border-gray-300 transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                            {q.category.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {q.difficulty}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                            {q.industry}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {q.category === 'technical_dsa' && (
                            <button
                              type="button"
                              onClick={() => setActiveTab('coding_whiteboard')}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                              <PenTool className="w-3 h-3" />
                              IDE Sandbox
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handlePracticeQuestionFromLibrary(q)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#3c4a59] hover:bg-[#2e3a47] px-3 py-1 rounded-lg shadow-sm active:scale-95 transition-all"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            Practice with AI
                          </button>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-sm text-gray-900 leading-snug">
                          {q.title}
                        </h4>
                        <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                          {q.question}
                        </p>
                      </div>

                      {/* Expandable Model Answer & Rubric */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                        >
                          {isExpanded ? 'Hide Ideal Answer & Evaluation Rubric' : 'View Ideal Answer & Evaluation Rubric'}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 p-4 bg-gray-50/90 rounded-xl border border-gray-200 space-y-3 text-xs animate-fadeIn">
                            <div>
                              <span className="font-bold text-emerald-800 block mb-1">
                                Model Answer:
                              </span>
                              <p className="text-gray-800 leading-relaxed bg-emerald-50/60 p-3 rounded-lg border border-emerald-100">
                                {q.idealAnswer}
                              </p>
                            </div>

                            <div>
                              <span className="font-bold text-slate-700 block mb-1">
                                Coach Tip:
                              </span>
                              <p className="text-gray-700 leading-relaxed">
                                {q.tip}
                              </p>
                            </div>

                            {q.keyCriteria && q.keyCriteria.length > 0 && (
                              <div>
                                <span className="font-bold text-slate-700 block mb-1">
                                  Key Evaluation Rubric:
                                </span>
                                <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                                  {q.keyCriteria.map((c, i) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {showDailyLimitModal && (
        <DailyUsageLimitModal
          featureLabel="Interview Prep"
          onUpgrade={() => paywallCheckout.subscribePro()}
          onUnlockReport={() => onNavigate('pricing')}
          onDismiss={() => setShowDailyLimitModal(false)}
        />
      )}
    </div>
  );
}

type InterviewCategory = {
  id: string;
  label: string;
  icon: typeof Users;
  color: string;
  bg: string;
  border: string;
  questions: Question[];
};

function InterviewCategoryCard({
  id,
  label,
  icon: Icon,
  color,
  bg,
  border,
  questions,
}: InterviewCategory) {
  void id;
  return (
    <div className="glass-card glass-card-interactive overflow-hidden">
      <div className={`px-6 py-5 border-b ${border} ${bg}`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm">
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <h3 className="font-bold text-gray-900">{label}</h3>
          <span className="ml-auto text-xs font-semibold text-gray-400 bg-white px-2.5 py-1 rounded-full border border-gray-100">
            {questions.length} questions
          </span>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {questions.map((q, i) => (
          <AccordionItem
            key={i}
            question={q.question}
            tip={q.tip}
            idealAnswer={q.idealAnswer}
            followUps={q.followUps}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}

function InterviewResultsBody({
  categories,
  results,
}: {
  categories: InterviewCategory[];
  results: InterviewData;
}) {
  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <InterviewCategoryCard key={category.id} {...category} />
      ))}

      {results.communicationTips && results.communicationTips.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Mic className="w-5 h-5 text-[#3c4a59]" />
            <h3 className="font-bold text-gray-900">Communication Tips</h3>
          </div>
          <ul className="space-y-2">
            {results.communicationTips.map((tip, i) => (
              <li key={i} className="text-sm text-gray-900 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {results.preparationSuggestions && results.preparationSuggestions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <ListChecks className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-gray-900">Preparation Roadmap</h3>
          </div>
          <ul className="space-y-2">
            {results.preparationSuggestions.map((tip, i) => (
              <li key={i} className="text-sm text-gray-900 flex items-start gap-2.5">
                <span className="w-5 h-5 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {results.starTips.length > 0 && (
        <div className="bg-gradient-to-br from-[#3c4a59] to-[#2e3a47] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-white">STAR Method & Interview Strategy</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="grid sm:grid-cols-2 gap-4">
              {results.starTips.map((tip, i) => (
                <div key={i} className="bg-white/10 border border-white/20 rounded-xl p-4">
                  <p className="text-sm text-white leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InterviewResultsPreview({
  categories,
}: {
  categories: InterviewCategory[];
  results: InterviewData;
}) {
  const previewCategory = categories[0];
  if (!previewCategory) return null;

  return <InterviewCategoryCard {...previewCategory} />;
}

function InterviewResultsPremium({
  categories,
  results,
}: {
  categories: InterviewCategory[];
  results: InterviewData;
}) {
  return (
    <div className="space-y-8">
      {categories.slice(1).map((category) => (
        <InterviewCategoryCard key={category.id} {...category} />
      ))}

      {results.communicationTips && results.communicationTips.length > 0 && (
        <div className="glass-card glass-card-interactive p-6">
          <div className="flex items-center gap-2 mb-4">
            <Mic className="w-5 h-5 text-[#3c4a59]" />
            <h3 className="font-bold text-gray-900">Communication Tips</h3>
          </div>
          <ul className="space-y-2">
            {results.communicationTips.map((tip, i) => (
              <li key={i} className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {results.preparationSuggestions && results.preparationSuggestions.length > 0 && (
        <div className="glass-card glass-card-interactive p-6">
          <div className="flex items-center gap-2 mb-4">
            <ListChecks className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-gray-900">Preparation Suggestions</h3>
          </div>
          <ul className="space-y-2">
            {results.preparationSuggestions.map((tip, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2.5">
                <span className="w-5 h-5 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* STAR Tips */}
      <div className="bg-gradient-to-br from-[#3c4a59] to-[#2e3a47] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <Star className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-white">STAR Method Answer Tips</h3>
          </div>
        </div>
        <div className="p-6">
          <div className="grid sm:grid-cols-2 gap-4">
            {results.starTips.map((tip, i) => (
              <div key={i} className="bg-white/10 border border-white/20 rounded-xl p-4">
                <p className="text-sm text-primary leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
