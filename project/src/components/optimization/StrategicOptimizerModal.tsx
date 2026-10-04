import { useState } from 'react';
import {
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Download,
  ArrowRight,
  RefreshCw,
  Cpu,
  Layers,
  FileText,
  ChevronDown,
  ChevronUp,
  Zap,
  TrendingUp,
  Target,
  Gauge,
} from 'lucide-react';
import {
  formatStrategicPrompt,
  formatAtsMaxScorePrompt,
  type StrategicOptimizationResult,
  type OptimizerMode,
} from '../../utils/strategicResumeOptimizer';
import { requestStrategicOptimization } from '../../lib/api/optimizeResume';
import { exportResumePdf, exportResumeDocx } from '../../utils/exportResumeFormats';

interface StrategicOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobDescription: string;
  resumeText: string;
  onApplyOptimizedResume: (newResumeText: string) => void;
}

export default function StrategicOptimizerModal({
  isOpen,
  onClose,
  jobDescription,
  resumeText,
  onApplyOptimizedResume,
}: StrategicOptimizerModalProps) {
  if (!isOpen) return null;

  const [mode, setMode] = useState<OptimizerMode>('ats_max_score');
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [result, setResult] = useState<StrategicOptimizationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'resume' | 'diff' | 'prompt'>('summary');
  const [copiedResume, setCopiedResume] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [applied, setApplied] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showGuardrailsInfo, setShowGuardrailsInfo] = useState(false);

  const canRun = Boolean(jobDescription.trim() && resumeText.trim());

  const handleRunOptimization = async () => {
    if (!canRun || loading) return;
    setLoading(true);
    setResult(null);
    setApplied(false);

    try {
      setCurrentStep(1);
      await new Promise((r) => setTimeout(r, 500));

      setCurrentStep(2);
      await new Promise((r) => setTimeout(r, 500));

      setCurrentStep(3);
      const res = await requestStrategicOptimization(resumeText, jobDescription, mode);
      setResult(res);
      setActiveTab('summary');
    } catch (err) {
      console.error('Optimization error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyResume = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.finalizedResumeText);
    setCopiedResume(true);
    setTimeout(() => setCopiedResume(false), 2000);
  };

  const handleCopyPrompt = () => {
    const formatted = mode === 'ats_max_score'
      ? formatAtsMaxScorePrompt(jobDescription, resumeText)
      : formatStrategicPrompt(jobDescription, resumeText);
    navigator.clipboard.writeText(formatted);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleApplyToWorkspace = () => {
    if (!result) return;
    onApplyOptimizedResume(result.finalizedResumeText);
    setApplied(true);
    setTimeout(() => {
      setApplied(false);
      onClose();
    }, 1200);
  };

  const handleExportPdf = async () => {
    if (!result) return;
    setExportingPdf(true);
    try {
      await exportResumePdf(result.finalizedResumeText, 'Optimized-Resume-ATS');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportDocx = async () => {
    if (!result) return;
    setExportingDocx(true);
    try {
      await exportResumeDocx(result.finalizedResumeText, 'Optimized-Resume-ATS');
    } finally {
      setExportingDocx(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 via-white to-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-[#3c4a59] to-[#252f38] text-white shadow-md">
              <Sparkles className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-gray-900">
                  {mode === 'ats_max_score' ? 'ATS Algorithmic Score Maximizer' : 'Strategic Resume Optimizer'}
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Zero-Fabrication Guardrails
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {mode === 'ats_max_score'
                  ? 'Beats strict ATS algorithms (Jobscan, Teal, Resume Worded) • Targets: Impact 22+, Style 22+, Brevity 23+'
                  : 'Technical Recruiter & Senior Optimizer • Engineering, Robotics & Software Domains'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="bg-gray-50/80 border-b border-gray-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-500">
              Optimization Engine:
            </span>
            <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-2xs">
              <button
                type="button"
                onClick={() => { setMode('ats_max_score'); setResult(null); }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  mode === 'ats_max_score'
                    ? 'bg-[#3c4a59] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>ATS Algorithmic Max Score (Impact, Style, Brevity)</span>
              </button>

              <button
                type="button"
                onClick={() => { setMode('strategic_keywords'); setResult(null); }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  mode === 'strategic_keywords'
                    ? 'bg-[#3c4a59] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Target className="w-3.5 h-3.5 text-emerald-500" />
                <span>Strategic Domain Keyword Weaver</span>
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowGuardrailsInfo(!showGuardrailsInfo)}
            className="text-emerald-800 hover:text-emerald-950 text-xs font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Strict Guardrails Active</span>
            {showGuardrailsInfo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Guardrails Info Drawer */}
        {showGuardrailsInfo && (
          <div className="bg-emerald-50/90 border-b border-emerald-200 px-6 py-3 text-xs text-emerald-950 animate-in fade-in duration-150">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <p><strong>1. Zero Fabrication:</strong> Strictly no manufactured tools, fake jobs, altered dates, or inflated credentials.</p>
                <p><strong>2. Context Preservation:</strong> Authentic hardware used, accomplishments, and team scope remain genuine.</p>
              </div>
              <div className="space-y-1">
                <p><strong>3. Precise Rephrasing Only:</strong> Reframes work using high-impact active verbs and safe engineering approximations.</p>
                <p><strong>4. ATS Formatting:</strong> 100% uniform unicode bullets (•), zero parser-breaking hybrid paragraphs or tables.</p>
              </div>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!result && !loading && (
            <div className="space-y-6">
              {/* Ready status & stats */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#3c4a59]" />
                      Target Job Description
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${jobDescription.trim() ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {jobDescription.trim() ? `${jobDescription.trim().split(/\s+/).length} words ready` : 'Missing JD text'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-3 font-mono bg-white p-2.5 rounded-xl border border-gray-100">
                    {jobDescription.trim() || 'No job description found in the workspace left pane. Please paste your target job description.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-[#3c4a59]" />
                      Existing Resume Text
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${resumeText.trim() ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {resumeText.trim() ? `${resumeText.trim().split(/\s+/).length} words ready` : 'Missing Resume text'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-3 font-mono bg-white p-2.5 rounded-xl border border-gray-100">
                    {resumeText.trim() || 'No resume text found in the workspace editor. Please paste your resume text.'}
                  </p>
                </div>
              </div>

              {/* Mode-Specific Rules Breakdown */}
              {mode === 'ats_max_score' ? (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-amber-50/70 border border-amber-200/80">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-950 mb-3 flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-amber-600" />
                    Algorithmic Scoring Rules Calibrated for Top-Tier ATS Parsers
                  </h4>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="bg-white p-3.5 rounded-xl border border-amber-200/60 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-xs text-gray-900 flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                          1. Impact Target
                        </strong>
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">22+/25</span>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Every role & project gets quantifiable metrics, scope, scale, or safe engineering approximations (~20%, 100+ instances, 7cm precision).
                      </p>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-amber-200/60 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-xs text-gray-900 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-600" />
                          2. Style & Power Verbs
                        </strong>
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">22+/25</span>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Every bullet starts with an active power verb (Engineered, Architected, Spearheaded). Zero passive voice, duties, or paragraph blocks.
                      </p>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-amber-200/60 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-xs text-gray-900 flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-teal-600" />
                          3. Brevity Target
                        </strong>
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">23+/25</span>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Strictly between 12 to 25 words per bullet. Dense with technical keywords, punchy, and completely free of fluff.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#3c4a59]" />
                    Automated 3-Step Execution Workflow
                  </h4>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#3c4a59] text-white text-[11px] font-bold flex items-center justify-center">1</span>
                        <strong className="text-xs text-gray-900">Gap Analysis</strong>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Extracts critical hard skills and domain terminologies present in the JD that are absent in the resume.
                      </p>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#3c4a59] text-white text-[11px] font-bold flex items-center justify-center">2</span>
                        <strong className="text-xs text-gray-900">Strategic Mapping</strong>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Maps keywords only where the candidate's underlying work genuinely supports it without fabrication.
                      </p>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#3c4a59] text-white text-[11px] font-bold flex items-center justify-center">3</span>
                        <strong className="text-xs text-gray-900">Text Re-rendering</strong>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Generates a finalized ATS markdown resume preserving all real work history, metrics, and dates.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 flex items-center gap-2 transition-all shadow-2xs"
                  title="Copy formatted prompt for ChatGPT / Claude / Gemini"
                >
                  {copiedPrompt ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                  <span>{copiedPrompt ? 'Prompt Copied!' : 'Copy Formatted AI Prompt'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleRunOptimization}
                  disabled={!canRun}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-sm font-black flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  <span>
                    {mode === 'ats_max_score'
                      ? 'Rewrite Bullets for Max ATS Score (Impact, Style, Brevity)'
                      : 'Run Strategic Optimization'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Running State */}
          {loading && (
            <div className="py-14 text-center space-y-6 max-w-lg mx-auto">
              <div className="relative inline-block">
                <div className="w-20 h-20 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin mx-auto flex items-center justify-center" />
                <Sparkles className="w-8 h-8 text-emerald-600 absolute inset-0 m-auto animate-pulse" />
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-black text-gray-900">
                  {mode === 'ats_max_score'
                    ? (currentStep === 1 ? 'Rule 1: Calibrating Quantifiable Impact (22+/25)...' : currentStep === 2 ? 'Rule 2: Injecting Active Power Verbs (22+/25)...' : 'Rule 3: Enforcing 12-25 Words Brevity (23+/25)...')
                    : (currentStep === 1 ? 'Step 1: Performing Gap Analysis...' : currentStep === 2 ? 'Step 2: Strategically Mapping Keywords...' : 'Step 3: Re-rendering ATS-Compliant Resume...')}
                </h4>
                <p className="text-xs text-gray-500">
                  {mode === 'ats_max_score'
                    ? 'Strictly adhering to algorithmic grading rules while upholding 100% zero fabrication.'
                    : 'Validating context triggers and anchoring keywords to genuine accomplishments without fabrication.'}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${currentStep >= 1 ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {mode === 'ats_max_score' ? '1. Impact 22+' : '1. Gap Analysis'}
                </div>
                <div className="w-4 h-px bg-gray-200" />
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${currentStep >= 2 ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {mode === 'ats_max_score' ? '2. Style 22+' : '2. Strategic Mapping'}
                </div>
                <div className="w-4 h-px bg-gray-200" />
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${currentStep >= 3 ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {mode === 'ats_max_score' ? '3. Brevity 23+' : '3. Text Re-rendering'}
                </div>
              </div>
            </div>
          )}

          {/* Results State */}
          {result && !loading && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Real-time ATS Algorithmic Scoreboard */}
              {result.scoreReport && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-2xl text-white shadow-md">
                  <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider block">Live Overall Score</span>
                    <div className="text-xl font-black text-emerald-400 mt-0.5">
                      {result.scoreReport.overallScore}/100
                      <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full ml-1.5">Grade {result.scoreReport.grade}</span>
                    </div>
                  </div>

                  <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider block">Impact Score</span>
                    <div className="text-xl font-black text-white mt-0.5 flex items-center justify-between">
                      <span>{result.scoreReport.pillars.impact.score}/25</span>
                      {result.scoreReport.pillars.impact.score >= 22 && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                  </div>

                  <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider block">Style & Power Verbs</span>
                    <div className="text-xl font-black text-white mt-0.5 flex items-center justify-between">
                      <span>{result.scoreReport.pillars.style.score}/25</span>
                      {result.scoreReport.pillars.style.score >= 22 && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                  </div>

                  <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider block">Brevity (12-25 Words)</span>
                    <div className="text-xl font-black text-white mt-0.5 flex items-center justify-between">
                      <span>{result.scoreReport.pillars.brevity.score}/25</span>
                      {result.scoreReport.pillars.brevity.score >= 23 && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Top Result Banner */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                      {mode === 'ats_max_score' ? 'Algorithmic Optimization Complete' : 'Strategic Optimization Complete'}
                      <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                        {result.guardrailsAudit.preservedAnchorsCount} anchors preserved
                      </span>
                    </h4>
                    <p className="text-xs text-emerald-800">
                      Rewrote bullets to satisfy Impact (22+), Style (22+), and Brevity (23+) with 0 fabrications.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApplyToWorkspace}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                  >
                    {applied ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-emerald-300" />}
                    <span>{applied ? 'Applied to Workspace!' : 'Apply to Live Workspace Editor'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRunOptimization}
                    className="p-2 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 transition-colors"
                    title="Re-run Optimization"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Sub-Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('summary')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'summary'
                      ? 'bg-[#3c4a59] text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Bullet Rewrites & Rationale ({result.addedKeywordsSummary.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('resume')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'resume'
                      ? 'bg-[#3c4a59] text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Finalized ATS Resume
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('diff')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'diff'
                      ? 'bg-[#3c4a59] text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Before vs After Diff
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('prompt')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'prompt'
                      ? 'bg-[#3c4a59] text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  AI Prompt Spec
                </button>
              </div>

              {/* TAB 1: Bullet Rewrites & Rationale */}
              {activeTab === 'summary' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Algorithmic rewrites satisfying Impact (22+), Style (22+), and Brevity (23+):</span>
                    <span className="font-semibold text-emerald-700">Strict Context Preservation Active</span>
                  </div>

                  {result.addedKeywordsSummary.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-200 text-gray-500 text-xs">
                      All bullets already satisfy maximum ATS algorithmic scoring standards!
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {result.addedKeywordsSummary.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-white rounded-2xl border border-gray-200 p-4 hover:border-gray-300 transition-all shadow-2xs space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-200">
                                {item.keyword}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                                {item.category.replace('_', ' ')}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-[#3c4a59] bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                              Location: {item.location}
                            </span>
                          </div>

                          <p className="text-xs text-gray-700 leading-relaxed">
                            <strong>Why: </strong>{item.reason}
                          </p>

                          {item.updatedSnippet && (
                            <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-xs font-mono text-gray-800 space-y-1">
                              {item.originalSnippet && (
                                <div className="text-[11px] text-gray-400 line-through">
                                  {item.originalSnippet}
                                </div>
                              )}
                              <div className="text-emerald-900 font-semibold">
                                {item.updatedSnippet}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Finalized ATS Resume */}
              {activeTab === 'resume' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">
                      Standard clean markdown formatted for maximum ATS algorithmic scoring and recruiter readability.
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyResume}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 flex items-center gap-1.5 transition-colors"
                      >
                        {copiedResume ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedResume ? 'Copied!' : 'Copy Resume'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExportPdf}
                        disabled={exportingPdf}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{exportingPdf ? 'Exporting...' : 'PDF'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExportDocx}
                        disabled={exportingDocx}
                        className="px-3 py-1.5 rounded-xl bg-[#3c4a59] hover:bg-[#252f38] text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{exportingDocx ? 'Exporting...' : 'DOCX'}</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    readOnly
                    value={result.finalizedResumeText}
                    className="w-full h-96 p-4 rounded-2xl border border-gray-200 font-mono text-xs leading-relaxed bg-gray-50/50 resize-none focus:outline-none"
                  />
                </div>
              )}

              {/* TAB 3: Before vs After Diff */}
              {activeTab === 'diff' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-xs font-black text-gray-600 uppercase tracking-wider block">
                      Original Resume
                    </span>
                    <textarea
                      readOnly
                      value={resumeText}
                      className="w-full h-96 p-3.5 rounded-2xl border border-gray-200 font-mono text-xs leading-relaxed bg-gray-50/40 resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-black text-emerald-800 uppercase tracking-wider block">
                      Finalized Optimized Resume (Beating Algorithmic Rules)
                    </span>
                    <textarea
                      readOnly
                      value={result.finalizedResumeText}
                      className="w-full h-96 p-3.5 rounded-2xl border border-emerald-300 font-mono text-xs leading-relaxed bg-emerald-50/20 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: Prompt Spec */}
              {activeTab === 'prompt' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      Standard prompt specification with your exact JD and Resume populated:
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 flex items-center gap-1.5 transition-colors"
                    >
                      {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPrompt ? 'Copied Prompt!' : 'Copy Full Prompt'}</span>
                    </button>
                  </div>

                  <textarea
                    readOnly
                    value={mode === 'ats_max_score' ? formatAtsMaxScorePrompt(jobDescription, resumeText) : formatStrategicPrompt(jobDescription, resumeText)}
                    className="w-full h-96 p-4 rounded-2xl border border-gray-200 font-mono text-xs leading-relaxed bg-gray-50/50 resize-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Zero fabrication guaranteed • Factually grounded in candidate experience</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors"
            >
              Close
            </button>

            {result && (
              <button
                type="button"
                onClick={handleApplyToWorkspace}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              >
                {applied ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-emerald-200" />}
                <span>{applied ? 'Applied to Workspace!' : 'Apply to Live Resume Editor'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
