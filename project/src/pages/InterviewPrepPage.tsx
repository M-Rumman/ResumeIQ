import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  checkFeatureAccess,
  recordFeatureUsage,
  FEATURE_TYPES,
  getFeatureLabel,
} from '../lib/usageLimits.js';
import UpgradePrompt from '../components/UpgradePrompt';
import UsageLimitBanner from '../components/UsageLimitBanner';
import PaywallBlurGate from '../components/PaywallBlurGate';
import BetaBanner from '../components/BetaBanner';
import PaywallCheckoutPreview from '../components/PaywallCheckoutPreview';
import { PAYMENTS_ENABLED } from '../lib/paymentsConfig.js';
import { FREE_TRIAL_REPORT_LIMIT } from '../lib/planConfig.js';
import { buildReportId } from '../lib/monetizationConfig.js';
import { usePaywallAccess } from '../hooks/usePaywallAccess';
import { usePaywallCheckout } from '../hooks/usePaywallCheckout';
import { fetchAiInterviewPrep } from '../lib/api/interviewPrepApi.js';
import { mapAiInterviewToDisplayWithContext, mapLocalInterviewToDisplay } from '../lib/api/mapInterviewAi.js';
import {
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Users,
  Code2,
  Brain,
  Star,
  Mic,
  ListChecks,
} from 'lucide-react';

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

function serializeStarTips(tips: string[]) {
  return tips.map((tip) => `- ${tip}`).join('\n');
}

interface InterviewPrepPageProps {
  onNavigate: (page: string) => void;
}

export default function InterviewPrepPage({ onNavigate }: InterviewPrepPageProps) {
  const [jobRole, setJobRole] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('mid');
  const [skills, setSkills] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<InterviewData | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [usageInfo, setUsageInfo] = useState({
    used: 0,
    limit: FREE_TRIAL_REPORT_LIMIT,
    isPro: false,
    loading: true,
  });

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

  const featureLabel = getFeatureLabel(FEATURE_TYPES.INTERVIEW_PREP);
  const hasFullAccess = !PAYMENTS_ENABLED || reportUnlocked;

  async function refreshUsageStatus() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUsageInfo({ used: 0, limit: FREE_TRIAL_REPORT_LIMIT, isPro: false, loading: false });
      return;
    }

    const access = await checkFeatureAccess(user.id, FEATURE_TYPES.INTERVIEW_PREP);
    setUsageInfo({
      used: access.used,
      limit: access.limit === Infinity ? FREE_TRIAL_REPORT_LIMIT : access.limit,
      isPro: access.isPro,
      loading: false,
    });
  }

  useEffect(() => {
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

    let prepResults: InterviewData;

    try {
      const ai = await fetchAiInterviewPrep(jobRole.trim(), experienceLevel, skills);
      prepResults = mapAiInterviewToDisplayWithContext(
        ai,
        jobRole.trim(),
        experienceLevel,
        skills,
      ) as InterviewData;
    } catch {
      prepResults = mapLocalInterviewToDisplay(
        jobRole.trim(),
        experienceLevel,
        skills,
      ) as InterviewData;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('interview_prep')
      .insert({
        user_id: user.id,
        job_role: jobRole.trim(),
        hr_questions: JSON.stringify(prepResults.hr),
        technical_questions: JSON.stringify(prepResults.technical),
        behavioral_questions: JSON.stringify(prepResults.behavioral),
        star_tips: serializeStarTips(prepResults.starTips),
      })
      .select('id')
      .single();

    setLoading(false);

    if (insertError) {
      setSaveError('Questions generated but could not be saved. Please try again.');
      return;
    }

    if (PAYMENTS_ENABLED && !access.isPro) {
      await recordFeatureUsage(user.id, FEATURE_TYPES.INTERVIEW_PREP);
    }

    if (inserted?.id) {
      setReportId(buildReportId('interview_prep', inserted.id));
    }

    setResults(prepResults);
    setSaveSuccess(true);
    await refreshUsageStatus();
    await refreshPaywallAccess();
    setTimeout(() => {
      document.getElementById('interview-results')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

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

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#3c4a59] rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900">AI Interview Preparation</h1>
          </div>
          <p className="text-gray-900 text-base font-medium ml-[52px]">
            Enter your target job role to generate personalized interview questions.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Input Card */}
        <div className="glass-card glass-card-interactive p-8">
          <div className="space-y-5">
            <div>
              <label htmlFor="job-role" className="block text-sm font-semibold text-gray-700 mb-2">
                Target Job Role
              </label>
              <input
                id="job-role"
                type="text"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                placeholder="e.g. Frontend Developer, Data Scientist, Marketing Manager..."
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder-gray-400 bg-gray-50 transition-all"
                data-clarity-mask="true"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="experience-level" className="block text-sm font-semibold text-gray-700 mb-2">
                  Experience Level
                </label>
                <select
                  id="experience-level"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400 bg-gray-50"
                >
                  <option value="entry">Entry / Junior</option>
                  <option value="mid">Mid-Level</option>
                  <option value="senior">Senior / Lead</option>
                </select>
              </div>
              <div>
                <label htmlFor="skills" className="block text-sm font-semibold text-gray-700 mb-2">
                  Key Skills
                </label>
                <input
                  id="skills"
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="React, TypeScript, Node.js"
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400 placeholder-gray-400 bg-gray-50"
                  data-clarity-mask="true"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!jobRole.trim() || loading}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 font-semibold px-6 py-3 rounded-xl text-sm transition-all ${
                jobRole.trim() && !loading
                  ? 'bg-[#3c4a59] text-white hover:bg-[#2e3a47] shadow-md shadow-gray-300 active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  This may take a while
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-primary mt-3">
            Role-specific HR, technical, and behavioral questions plus communication and prep tips.
          </p>
          {!usageInfo.loading && (
            <div className="mt-4">
              <UsageLimitBanner
                used={usageInfo.used}
                limit={usageInfo.limit}
                featureLabel={featureLabel}
                isPro={usageInfo.isPro}
              />
            </div>
          )}
          {upgradeMessage && (
            <div className="mt-6">
              <UpgradePrompt
                message={upgradeMessage}
                onUpgrade={() => paywallCheckout.subscribePro()}
              />
            </div>
          )}
          {saveError && (
            <p className="text-sm text-center text-red-600 font-medium mt-4">{saveError}</p>
          )}
        </div>

        {/* Results */}
        {results && (
          <div id="interview-results" className="mt-10 space-y-8">
            {!PAYMENTS_ENABLED && (
              <BetaBanner onPricingSoon={() => onNavigate('pricing')} />
            )}
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-gray-200" />
              <h2 className="font-extrabold text-gray-900 text-xl px-4">
                Interview Questions for{' '}
                <span className="text-[#3c4a59] font-extrabold">{jobRole}</span>
              </h2>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            {saveSuccess && (
              <p className="text-center text-sm text-[#3c4a59] font-medium">
                Session saved successfully. View it anytime on your Dashboard.
              </p>
            )}

            {PAYMENTS_ENABLED && !hasFullAccess && (
              <p className="text-center text-xs text-primary">
                Premium sections are locked. Unlock this report for $2 or upgrade to Pro for $5/month.
              </p>
            )}

            {paywallCheckout.error && (
              <p className="text-center text-sm text-red-600 font-medium">{paywallCheckout.error}</p>
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
      </div>
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
