import { useEffect, useState } from 'react';
import {
  FileText,
  Target,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  Sparkles,
  Zap,
  Download,
  Lock,
} from 'lucide-react';
import LogoMark from '../components/LogoMark';
import { supabase } from '../lib/supabase.js';
import { fetchAiResumeAnalysis } from '../lib/api/analyzeResume.js';
import { mapAiResumeToDisplay, type ResumeDisplayResults } from '../lib/api/mapAiResults.js';
import {
  checkFeatureAccess,
  recordFeatureUsage,
  FEATURE_TYPES,
  getFeatureLabel,
} from '../lib/usageLimits.js';
import UpgradePrompt from '../components/UpgradePrompt';
import UsageLimitBanner from '../components/UsageLimitBanner';
import ResumeFileUpload from '../components/ResumeFileUpload';
import PaywallBlurGate from '../components/PaywallBlurGate';
import BetaBanner from '../components/BetaBanner';
import PaywallCheckoutPreview from '../components/PaywallCheckoutPreview';
import { PAYMENTS_ENABLED } from '../lib/paymentsConfig.js';
import { canExportPdf } from '../lib/planAccess.js';
import { FREE_TRIAL_REPORT_LIMIT } from '../lib/planConfig.js';
import { downloadResumeAnalysisPdf } from '../utils/exportReportPdf.js';
import { buildReportId } from '../lib/monetizationConfig.js';
import { usePaywallAccess } from '../hooks/usePaywallAccess';
import { usePaywallCheckout } from '../hooks/usePaywallCheckout';

type AnalysisResults = ResumeDisplayResults;

interface ResumeAnalyzerPageProps {
  onNavigate: (page: string) => void;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-1000`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export default function ResumeAnalyzerPage({ onNavigate }: ResumeAnalyzerPageProps) {
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [usageInfo, setUsageInfo] = useState({
    used: 0,
    limit: FREE_TRIAL_REPORT_LIMIT,
    isPro: false,
    loading: true,
  });
  const [exportingPdf, setExportingPdf] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  const {
    unlocked: reportUnlocked,
    userId,
    isPro,
    refresh: refreshPaywallAccess,
  } = usePaywallAccess(reportId);

  const paywallCheckout = usePaywallCheckout({
    userId,
    reportId,
  });

  const featureLabel = getFeatureLabel(FEATURE_TYPES.RESUME_ANALYSIS);
  const hasFullAccess = !PAYMENTS_ENABLED || reportUnlocked;
  const canExport = canExportPdf(isPro || usageInfo.isPro);

  async function refreshUsageStatus() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUsageInfo({ used: 0, limit: FREE_TRIAL_REPORT_LIMIT, isPro: false, loading: false });
      return;
    }

    const access = await checkFeatureAccess(user.id, FEATURE_TYPES.RESUME_ANALYSIS);
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

  async function handleAnalyze() {
    setAnalyzing(true);
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
      setAnalyzing(false);
      setSaveError('You must be logged in to save an analysis.');
      return;
    }

    const access = await checkFeatureAccess(user.id, FEATURE_TYPES.RESUME_ANALYSIS);

    if (access.error) {
      setAnalyzing(false);
      setSaveError(access.error);
      return;
    }

    const text = resumeText.trim();

    if (!text) {
      setAnalyzing(false);
      setSaveError('Please upload a resume or paste your resume text to continue.');
      return;
    }

    let analysisResults: AnalysisResults;
    try {
      const ai = await fetchAiResumeAnalysis(text, jobDescription.trim());
      analysisResults = mapAiResumeToDisplay(ai) as AnalysisResults;
    } catch {
      setAnalyzing(false);
      setSaveError(
        'Resume analysis is temporarily unavailable because the AI service could not be reached. Please try again in a few moments.',
      );
      return;
    }

    const strengths = analysisResults.improvements
      .filter((i) => i.type === 'success')
      .map((i) => i.text)
      .join('\n');
    const improvements = analysisResults.improvements
      .filter((i) => i.type !== 'success')
      .map((i) => `- ${i.text}`)
      .join('\n');

    const { data: inserted, error: insertError } = await supabase
      .from('resume_analysis')
      .insert({
        user_id: user.id,
        ats_score: analysisResults.atsScore,
        strengths: strengths || 'AI analysis completed.',
        improvements: improvements || '- See full report in app.',
      })
      .select('id')
      .single();

    setAnalyzing(false);

    if (insertError) {
      setSaveError('Analysis completed but could not be saved. Please try again.');
      return;
    }

    if (PAYMENTS_ENABLED && !access.isPro) {
      await recordFeatureUsage(user.id, FEATURE_TYPES.RESUME_ANALYSIS);
    }

    if (inserted?.id) {
      setReportId(buildReportId('resume_analysis', inserted.id));
    }

    setResults(analysisResults);
    setSaveSuccess(true);
    await refreshUsageStatus();
    await refreshPaywallAccess();
    setTimeout(() => {
      document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  const canAnalyze = resumeText.trim() && jobDescription.trim();

  return (
    <div className="min-h-screen">
      <div className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-3">
            <LogoMark className="w-10 h-10 rounded-xl" />
            <h1 className="text-3xl font-extrabold text-gray-900">AI Resume Analyzer</h1>
          </div>
          <p className="text-gray-900 text-base font-medium ml-[52px]">
            Upload a PDF or DOCX resume, or paste text, then add a job description for ATS feedback.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="glass-card-solid">
            <div className="px-6 pt-6 pb-4 border-b border-gray-50">
              <h2 className="font-bold text-gray-900">Your Resume</h2>
              <p className="text-sm text-primary mt-1">Upload PDF/DOCX or paste your resume text below.</p>
            </div>
            <div className="p-6 space-y-4">
              <ResumeFileUpload
                disabled={analyzing}
                onTextExtracted={(text) => {
                  setResumeText(text);
                  setSaveError(null);
                }}
                onClear={() => setResumeText('')}
              />
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your resume text here..."
                className="input-neu h-56 resize-none"
                data-clarity-mask="true"
              />
            </div>
          </div>

          <div className="glass-card-solid">
            <div className="px-6 pt-6 pb-4 border-b border-gray-50">
              <h2 className="font-bold text-gray-900">Target Job Description</h2>
              <p className="text-sm text-primary mt-1">Paste the job posting to compare keyword match.</p>
            </div>
            <div className="p-6">
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the target job description here..."
                className="input-neu h-56 resize-none"
                data-clarity-mask="true"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-8">
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze || analyzing}
            className={`flex items-center gap-3 font-semibold px-10 py-4 rounded-2xl text-base transition-all shadow-lg ${
              canAnalyze && !analyzing
                ? 'bg-[#3c4a59] text-white hover:bg-[#2e3a47] shadow-gray-300 hover:shadow-gray-400 active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
            }`}
          >
            {analyzing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                This may take a while
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Analyze Resume
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

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

        {!canAnalyze && !results && (
          <p className="text-center text-xs text-primary mt-3">
            Please add your resume (upload or paste) and a job description to continue.
          </p>
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
          <p className="text-center text-sm text-red-600 font-medium mt-4">{saveError}</p>
        )}

        {results && (
          <div id="results-section" className="mt-14 space-y-8">
            {!PAYMENTS_ENABLED && (
              <BetaBanner onPricingSoon={() => onNavigate('pricing')} />
            )}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <div className="h-px flex-1 bg-gray-200" />
                <h2 className="font-extrabold text-gray-900 text-xl px-4 whitespace-nowrap">Analysis Results</h2>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              {canExport ? (
                <button
                  type="button"
                  disabled={exportingPdf}
                  onClick={async () => {
                    setExportingPdf(true);
                    try {
                      await downloadResumeAnalysisPdf(results);
                    } finally {
                      setExportingPdf(false);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 self-center text-sm font-semibold text-[#3c4a59] bg-gray-50 hover:bg-gray-100 border border-gray-200 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
                >
                  <Download className="w-4 h-4" />
                  {exportingPdf ? 'Exporting…' : 'Export PDF Report'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => paywallCheckout.subscribePro()}
                  className="inline-flex items-center justify-center gap-2 self-center text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-4 py-2.5 rounded-xl transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  PDF Export (Pro)
                </button>
              )}
            </div>

            {saveSuccess && (
              <p className="text-center text-sm text-[#3c4a59] font-medium">
                Analysis saved successfully. View it anytime on your Dashboard.
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
                <ResumeResultsBody results={results} />
                <PaywallCheckoutPreview onPricingSoon={() => onNavigate('pricing')} />
              </div>
            ) : (
              <>
                <div id="paywall-free-preview" className="space-y-8">
                  <ResumeResultsPreview results={results} />
                </div>
                <div className="space-y-8">
                  {hasFullAccess || !reportId ? (
                    <ResumeResultsPremium results={results} />
                  ) : (
                    <PaywallBlurGate
                      unlocked={false}
                      previewPercent={0}
                      reportId={reportId}
                      onUnlockReport={paywallCheckout.unlockReport}
                      onSubscribePro={paywallCheckout.subscribePro}
                    >
                      <ResumeResultsPremium results={results} />
                    </PaywallBlurGate>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResumeResultsBody({ results }: { results: AnalysisResults }) {
  return (
    <>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-[#3c4a59]" />
                    <h3 className="font-bold text-gray-900">ATS Compatibility</h3>
                  </div>
                  <span className="text-3xl font-extrabold text-[#3c4a59]">{results.atsScore}%</span>
                </div>
                <ProgressBar value={results.atsScore} color="bg-gradient-to-r from-[#4a5a6a] to-[#3c4a59]" />
                <p className="text-xs text-gray-700 mt-2">
                  {results.atsScore >= 80 ? 'Good ATS compatibility — a few improvements needed.' : 'Needs significant optimization for ATS systems.'}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-gray-900">Job Match Score</h3>
                  </div>
                  <span className="text-3xl font-extrabold text-emerald-600">{results.matchScore}%</span>
                </div>
                <ProgressBar value={results.matchScore} color="bg-gradient-to-r from-emerald-500 to-emerald-600" />
                <p className="text-xs text-gray-700 mt-2">
                  Your resume matches {results.matchScore}% of the job description requirements.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <FileText className="w-5 h-5 text-[#3c4a59]" />
                <h3 className="font-bold text-gray-900">Resume Sections</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Detected</p>
                  <div className="flex flex-wrap gap-2">
                    {results.detectedSections.length > 0 ? (
                      results.detectedSections.map((section) => (
                        <span
                          key={section}
                          className="bg-green-50 text-green-800 border border-green-100 text-xs font-semibold px-3 py-1.5 rounded-full"
                        >
                          {section}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-700">None detected</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Missing</p>
                  <div className="flex flex-wrap gap-2">
                    {results.missingSections.length > 0 ? (
                      results.missingSections.map((section) => (
                        <span
                          key={section}
                          className="bg-amber-50 text-amber-800 border border-amber-100 text-xs font-semibold px-3 py-1.5 rounded-full"
                        >
                          {section}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-700">All standard sections found</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {results.missingKeywords.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <h3 className="font-bold text-gray-900">Keyword Suggestions</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {results.missingKeywords.map((kw) => (
                    <span key={kw} className="bg-red-50 text-red-700 border border-red-100 text-xs font-semibold px-3 py-1.5 rounded-full">
                      + {kw}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-gray-700 mt-4">
                  Add these keywords naturally in your experience and skills sections.
                </p>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-gray-900">Resume Improvements</h3>
              </div>
              <div className="space-y-3">
                {results.improvements.map((item, i) => {
                  const styleMap = {
                    warning: { bg: 'bg-amber-50 border-amber-100', icon: 'text-amber-600', text: 'text-amber-900' },
                    error: { bg: 'bg-red-50 border-red-100', icon: 'text-red-600', text: 'text-red-900' },
                    info: { bg: 'bg-gray-50 border-gray-200', icon: 'text-[#3c4a59]', text: 'text-gray-900' },
                    success: { bg: 'bg-green-50 border-green-100', icon: 'text-green-600', text: 'text-green-900' },
                  } as const;
                  const styles = styleMap[item.type];
                  const Icon = item.type === 'success' ? CheckCircle2 : AlertCircle;
                  return (
                    <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${styles.bg}`}>
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${styles.icon}`} />
                      <p className={`text-sm font-medium ${styles.text}`}>{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <FileText className="w-5 h-5 text-[#3c4a59]" />
                <h3 className="font-bold text-gray-900">Formatting Suggestions</h3>
              </div>
              {results.formattingSuggestions.length > 0 ? (
                <ul className="space-y-2.5">
                  {results.formattingSuggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-900">
                      <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-gray-700">{i + 1}</span>
                      </div>
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-700">
                  Add more experience or project bullets to your resume for personalized rewrites.
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-5 h-5 text-[#3c4a59]" />
                <h3 className="font-bold text-gray-900">Stronger Bullet Point Suggestions</h3>
              </div>
              {results.bulletSuggestions.length > 0 ? (
                <div className="space-y-5">
                  {results.bulletSuggestions.map((item, i) => (
                    <div key={i} className="grid sm:grid-cols-2 gap-3">
                      <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                        <span className="text-xs font-bold text-red-600 uppercase tracking-wide block mb-2">Before</span>
                        <p className="text-sm text-red-900">{item.before}</p>
                      </div>
                      <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                        <span className="text-xs font-bold text-green-700 uppercase tracking-wide block mb-2">After</span>
                        <p className="text-sm text-green-900 font-medium">{item.after}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-700">
                  Paste experience bullets in your resume to see before/after rewrites here.
                </p>
              )}
            </div>
    </>
  );
}

function ResumeResultsPreview({ results }: { results: AnalysisResults }) {
  return (
    <>
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[#3c4a59]" />
              <h3 className="font-bold text-gray-900">ATS Compatibility</h3>
            </div>
            <span className="text-3xl font-extrabold text-[#3c4a59]">{results.atsScore}%</span>
          </div>
          <ProgressBar value={results.atsScore} color="bg-gradient-to-r from-[#4a5a6a] to-[#3c4a59]" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-gray-900">Job Match Score</h3>
            </div>
            <span className="text-3xl font-extrabold text-emerald-600">{results.matchScore}%</span>
          </div>
          <ProgressBar value={results.matchScore} color="bg-gradient-to-r from-emerald-500 to-emerald-600" />
        </div>
      </div>
    </>
  );
}

function ResumeResultsPremium({ results }: { results: AnalysisResults }) {
  return (
    <>
      {results.missingKeywords.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <h3 className="font-bold text-gray-900">Keyword Suggestions</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {results.missingKeywords.map((kw) => (
              <span key={kw} className="bg-red-50 text-red-700 border border-red-100 text-xs font-semibold px-3 py-1.5 rounded-full">
                + {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-gray-900">Resume Improvements</h3>
        </div>
        <div className="space-y-3">
          {results.improvements.map((item, i) => {
            const styleMap = {
              warning: { bg: 'bg-amber-50 border-amber-100', icon: 'text-amber-600', text: 'text-amber-900' },
              error: { bg: 'bg-red-50 border-red-100', icon: 'text-red-600', text: 'text-red-900' },
              info: { bg: 'bg-gray-50 border-gray-200', icon: 'text-[#3c4a59]', text: 'text-gray-900' },
              success: { bg: 'bg-green-50 border-green-100', icon: 'text-green-600', text: 'text-green-900' },
            } as const;
            const styles = styleMap[item.type];
            const Icon = item.type === 'success' ? CheckCircle2 : AlertCircle;
            return (
              <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${styles.bg}`}>
                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${styles.icon}`} />
                <p className={`text-sm font-medium ${styles.text}`}>{item.text}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <FileText className="w-5 h-5 text-[#3c4a59]" />
          <h3 className="font-bold text-gray-900">Formatting Suggestions</h3>
        </div>
        {results.formattingSuggestions.length > 0 ? (
          <ul className="space-y-2.5">
            {results.formattingSuggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-900">
                <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-gray-700">{i + 1}</span>
                </div>
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-700">No formatting suggestions available.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-[#3c4a59]" />
          <h3 className="font-bold text-gray-900">Stronger Bullet Point Suggestions</h3>
        </div>
        {results.bulletSuggestions.length > 0 ? (
          <div className="space-y-5">
            {results.bulletSuggestions.map((item, i) => (
              <div key={i} className="grid sm:grid-cols-2 gap-3">
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <span className="text-xs font-bold text-red-600 uppercase tracking-wide block mb-2">Before</span>
                  <p className="text-sm text-red-900">{item.before}</p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <span className="text-xs font-bold text-green-700 uppercase tracking-wide block mb-2">After</span>
                  <p className="text-sm text-green-900 font-medium">{item.after}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-700">No bullet rewrites available.</p>
        )}
      </div>
    </>
  );
}
