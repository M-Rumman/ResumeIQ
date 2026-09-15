import { useState } from 'react';
import {
  Sparkles,
  Download,
  Zap,
  TrendingUp,
  FileText,
  Wand2,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';
import { type KeywordAnalysisReport } from '../../utils/keywordClassifier';
import { type RealTimeScoreReport } from '../../utils/realtimeScorer';
import { exportResumePdf, exportResumeDocx } from '../../utils/exportResumeFormats';

interface SplitScreenWorkspaceProps {
  resumeText: string;
  jobDescription: string;
  onResumeChange: (newText: string) => void;
  onJdChange: (newText: string) => void;
  keywordReport: KeywordAnalysisReport;
  scoreReport: RealTimeScoreReport;
  onOpenPowerVerbs: () => void;
  onOpenImpactPrompts: () => void;
  onOpenBulletGenerator: () => void;
}

export default function SplitScreenWorkspace({
  resumeText,
  jobDescription,
  onResumeChange,
  onJdChange,
  keywordReport,
  scoreReport,
  onOpenPowerVerbs,
  onOpenImpactPrompts,
  onOpenBulletGenerator,
}: SplitScreenWorkspaceProps) {
  const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'hard_skill' | 'soft_skill' | 'credential'>('all');
  const [keywordSearch, setKeywordSearch] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);

  const handleInsertKeyword = (term: string) => {
    // If resume has a SKILLS section, insert there, otherwise append to resume
    const skillsRegex = /(skills|technical skills|technologies)(:\s*|\n)/i;
    if (skillsRegex.test(resumeText)) {
      const updated = resumeText.replace(skillsRegex, `$1$2• ${term}\n`);
      onResumeChange(updated);
    } else {
      onResumeChange(resumeText + `\n• ${term}`);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await exportResumePdf(resumeText, 'Optimized-Resume');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportDocx = async () => {
    setExportingDocx(true);
    try {
      await exportResumeDocx(resumeText, 'Optimized-Resume');
    } finally {
      setExportingDocx(false);
    }
  };

  // Filter keywords
  const allKeywords = [
    ...keywordReport.hardSkills.items,
    ...keywordReport.softSkills.items,
    ...keywordReport.credentials.items,
  ];

  const visibleKeywords = allKeywords.filter((k) => {
    const matchesCategory = activeCategoryTab === 'all' || k.category === activeCategoryTab;
    const matchesSearch = !keywordSearch.trim() || k.term.toLowerCase().includes(keywordSearch.toLowerCase());
    const matchesMissing = !filterMissingOnly || k.status === 'missing';
    return matchesCategory && matchesSearch && matchesMissing;
  });

  return (
    <div className="space-y-4">
      {/* Top Studio Control Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Real-time score indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#3c4a59] text-white px-3 py-1.5 rounded-xl shadow-sm">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-black">Live Score: {scoreReport.overallScore}/100</span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">Grade {scoreReport.grade}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-gray-600">
            <span>JD Keyword Match: <strong className="text-[#3c4a59]">{keywordReport.overallMatchScore}%</strong></span>
          </div>
        </div>

        {/* AI Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenPowerVerbs}
            className="px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-800 flex items-center gap-1.5 transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Power Verbs
          </button>
          <button
            type="button"
            onClick={onOpenImpactPrompts}
            className="px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-800 flex items-center gap-1.5 transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            Quantify Bullets
          </button>
          <button
            type="button"
            onClick={onOpenBulletGenerator}
            className="px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-800 flex items-center gap-1.5 transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5 text-[#3c4a59]" />
            Bullet Generator
          </button>

          {/* Export Actions */}
          <div className="h-5 w-px bg-gray-200 mx-1 hidden sm:block" />

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-[#3c4a59] flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exportingPdf ? 'Exporting...' : 'PDF'}
          </button>
          <button
            type="button"
            onClick={handleExportDocx}
            disabled={exportingDocx}
            className="px-3 py-1.5 rounded-xl bg-[#3c4a59] hover:bg-[#252f38] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exportingDocx ? 'Exporting...' : 'Word (.docx)'}
          </button>
        </div>
      </div>

      {/* Side-by-Side Split Workspace Grid */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        
        {/* LEFT PANE: Target Job Description & Automated Keyword Extraction */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[750px] overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/70">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#3c4a59]" />
                <h4 className="text-sm font-black text-gray-900">Target Job Posting & Keywords</h4>
              </div>
              <span className="text-[11px] font-bold text-gray-500">
                {visibleKeywords.length} keywords found
              </span>
            </div>

            {/* Keyword Category Tabs */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                onClick={() => setActiveCategoryTab('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                  activeCategoryTab === 'all' ? 'bg-[#3c4a59] text-white' : 'bg-white border text-gray-700'
                }`}
              >
                All ({allKeywords.length})
              </button>
              <button
                onClick={() => setActiveCategoryTab('hard_skill')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                  activeCategoryTab === 'hard_skill' ? 'bg-[#3c4a59] text-white' : 'bg-white border text-gray-700'
                }`}
              >
                Hard Skills ({keywordReport.hardSkills.percentage}%)
              </button>
              <button
                onClick={() => setActiveCategoryTab('soft_skill')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                  activeCategoryTab === 'soft_skill' ? 'bg-[#3c4a59] text-white' : 'bg-white border text-gray-700'
                }`}
              >
                Soft Skills ({keywordReport.softSkills.percentage}%)
              </button>
              <button
                onClick={() => setActiveCategoryTab('credential')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                  activeCategoryTab === 'credential' ? 'bg-[#3c4a59] text-white' : 'bg-white border text-gray-700'
                }`}
              >
                Credentials ({keywordReport.credentials.percentage}%)
              </button>
            </div>

            {/* Search & Missing toggle */}
            <div className="flex items-center gap-2 mt-3">
              <input
                type="text"
                value={keywordSearch}
                onChange={(e) => setKeywordSearch(e.target.value)}
                placeholder="Search extracted skills..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#3c4a59]"
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filterMissingOnly}
                  onChange={(e) => setFilterMissingOnly(e.target.checked)}
                  className="rounded text-[#3c4a59]"
                />
                <span className="font-semibold text-rose-700">Missing Only</span>
              </label>
            </div>
          </div>

          {/* Keyword Pill Cloud with 1-click Insert */}
          <div className="p-3 bg-gray-50/40 border-b border-gray-100 max-h-48 overflow-y-auto">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
              Click any keyword to add to your resume:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {visibleKeywords.map((k) => {
                const isMatched = k.status === 'matched';
                const isUnder = k.status === 'under_expressed';
                return (
                  <button
                    key={k.term}
                    onClick={() => handleInsertKeyword(k.term)}
                    title={`Click to insert into resume. Status: ${k.status}. ${k.recommendation}`}
                    className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                      isMatched
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                        : isUnder
                        ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                        : 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100'
                    }`}
                  >
                    {isMatched ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    ) : isUnder ? (
                      <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                    ) : (
                      <PlusCircle className="w-3 h-3 text-rose-600 shrink-0 group-hover:scale-110 transition-transform" />
                    )}
                    <span>{k.term}</span>
                    <span className="text-[9px] opacity-60">({k.occurrencesInResume})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Raw Job Description Textarea */}
          <div className="flex-1 p-3 flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Raw Job Description Text
            </span>
            <textarea
              value={jobDescription}
              onChange={(e) => onJdChange(e.target.value)}
              placeholder="Paste target job description here..."
              className="w-full flex-1 p-3 rounded-xl border border-gray-200 text-xs font-sans resize-none focus:outline-none focus:ring-2 focus:ring-[#3c4a59]"
            />
          </div>
        </div>

        {/* RIGHT PANE: Live Resume Editor with Real-Time Feedback */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[750px] overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#3c4a59]" />
              <h4 className="text-sm font-black text-gray-900">Live Resume Editor</h4>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 font-semibold">
              <span>{scoreReport.wordCount} words</span>
              <span>•</span>
              <span>{scoreReport.totalBullets} bullets</span>
              <span>•</span>
              <span className="text-emerald-700 font-bold">{scoreReport.metricsCount} quantified</span>
            </div>
          </div>

          <div className="flex-1 p-3 flex flex-col">
            <textarea
              value={resumeText}
              onChange={(e) => onResumeChange(e.target.value)}
              placeholder="Paste or write your resume text here..."
              className="w-full flex-1 p-4 rounded-xl border border-gray-200 text-xs font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#3c4a59] shadow-inner"
            />
          </div>

          {/* Bottom Live Tips Bar */}
          <div className="p-3 bg-gray-50/80 border-t border-gray-100 text-xs text-gray-600 flex items-center justify-between">
            <div className="flex items-center gap-2 line-clamp-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                <strong>Next Best Action: </strong>
                {scoreReport.pillars.impact.score < 20
                  ? scoreReport.pillars.impact.actionableTip
                  : scoreReport.pillars.style.actionableTip}
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
