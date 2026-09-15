import { useState, useMemo } from 'react';
import {
  Split,
  FileText,
  ShieldAlert,
  Sparkles,
  Download,
  Linkedin,
  Award
} from 'lucide-react';
import { scanResumeFormatting } from '../../utils/atsFormatScanner';
import { extractAndClassifyKeywords } from '../../utils/keywordClassifier';
import { calculateRealtimeScore } from '../../utils/realtimeScorer';
import RealTimeScoreDashboard from './RealTimeScoreDashboard';
import SplitScreenWorkspace from './SplitScreenWorkspace';
import FormattingAlertsCard from './FormattingAlertsCard';
import SectionAuditCard from './SectionAuditCard';
import TailoredCoverLetterCard from './TailoredCoverLetterCard';
import PowerVerbModal from './PowerVerbModal';
import QuantifiableImpactModal from './QuantifiableImpactModal';
import BulletPointGeneratorModal from './BulletPointGeneratorModal';
import LinkedInSyncModal from './LinkedInSyncModal';
import { exportResumePdf, exportResumeDocx } from '../../utils/exportResumeFormats';

interface OptimizationStudioProps {
  resumeText: string;
  jobDescription: string;
  onResumeChange: (text: string) => void;
  onJdChange: (text: string) => void;
}

export default function OptimizationStudio({
  resumeText,
  jobDescription,
  onResumeChange,
  onJdChange,
}: OptimizationStudioProps) {
  // Navigation tabs inside the studio
  const [activeTab, setActiveTab] = useState<'workspace' | 'formatting' | 'audits' | 'cover_letter'>('workspace');

  // Modals state
  const [showPowerVerbs, setShowPowerVerbs] = useState(false);
  const [showImpactPrompts, setShowImpactPrompts] = useState(false);
  const [showBulletGen, setShowBulletGen] = useState(false);
  const [showLinkedInSync, setShowLinkedInSync] = useState(false);

  // Computations
  const formattingReport = useMemo(() => scanResumeFormatting(resumeText), [resumeText]);
  const keywordReport = useMemo(() => extractAndClassifyKeywords(jobDescription, resumeText), [jobDescription, resumeText]);
  const scoreReport = useMemo(() => calculateRealtimeScore(resumeText), [resumeText]);

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await exportResumePdf(resumeText, 'ResuV-Optimized-Resume');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportDocx = async () => {
    setExportingDocx(true);
    try {
      await exportResumeDocx(resumeText, 'ResuV-Optimized-Resume');
    } finally {
      setExportingDocx(false);
    }
  };

  const handleApplyBullet = (oldBullet: string, newBullet: string) => {
    if (resumeText.includes(oldBullet)) {
      onResumeChange(resumeText.replace(oldBullet, newBullet));
    } else {
      onResumeChange(resumeText + '\n' + newBullet);
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Header Toolbar */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-[#3c4a59] text-white">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-black text-gray-900">Optimization Studio & Live Editor</h2>
              <p className="text-xs text-gray-500">Real-time ATS keyword matching, live grading, formatting alerts & multi-format export</p>
            </div>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLinkedInSync(true)}
            className="px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-800 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Linkedin className="w-4 h-4 text-[#0a66c2]" />
            LinkedIn Sync
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf || !resumeText.trim()}
            className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exportingPdf ? 'Exporting PDF...' : 'Download PDF'}
          </button>
          <button
            type="button"
            onClick={handleExportDocx}
            disabled={exportingDocx || !resumeText.trim()}
            className="px-4 py-2 rounded-xl bg-[#3c4a59] hover:bg-[#252f38] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exportingDocx ? 'Generating DOCX...' : 'Download Word (.docx)'}
          </button>
        </div>
      </div>

      {/* Real-Time Live Grade Dashboard */}
      <RealTimeScoreDashboard
        report={scoreReport}
        onOpenImpactPrompts={() => setShowImpactPrompts(true)}
        onOpenPowerVerbs={() => setShowPowerVerbs(true)}
      />

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('workspace')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'workspace'
              ? 'bg-[#3c4a59] text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Split className="w-4 h-4" />
          <span>Side-by-Side Workspace</span>
        </button>

        <button
          onClick={() => setActiveTab('formatting')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'formatting'
              ? 'bg-[#3c4a59] text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>ATS Formatting Alerts</span>
          {formattingReport.issues.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
              {formattingReport.issues.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audits')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'audits'
              ? 'bg-[#3c4a59] text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Section-by-Section Audits</span>
        </button>

        <button
          onClick={() => setActiveTab('cover_letter')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'cover_letter'
              ? 'bg-[#3c4a59] text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Tailored Cover Letter</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'workspace' && (
        <SplitScreenWorkspace
          resumeText={resumeText}
          jobDescription={jobDescription}
          onResumeChange={onResumeChange}
          onJdChange={onJdChange}
          keywordReport={keywordReport}
          scoreReport={scoreReport}
          onOpenPowerVerbs={() => setShowPowerVerbs(true)}
          onOpenImpactPrompts={() => setShowImpactPrompts(true)}
          onOpenBulletGenerator={() => setShowBulletGen(true)}
        />
      )}

      {activeTab === 'formatting' && (
        <FormattingAlertsCard report={formattingReport} />
      )}

      {activeTab === 'audits' && (
        <SectionAuditCard resumeText={resumeText} />
      )}

      {activeTab === 'cover_letter' && (
        <TailoredCoverLetterCard
          resumeText={resumeText}
          jobDescription={jobDescription}
        />
      )}

      {/* Interactive Feature Modals */}
      <PowerVerbModal
        resumeText={resumeText}
        isOpen={showPowerVerbs}
        onClose={() => setShowPowerVerbs(false)}
        onApplyReplacement={(updated) => onResumeChange(updated)}
      />

      <QuantifiableImpactModal
        resumeText={resumeText}
        isOpen={showImpactPrompts}
        onClose={() => setShowImpactPrompts(false)}
        onApplyBullet={handleApplyBullet}
      />

      <BulletPointGeneratorModal
        isOpen={showBulletGen}
        onClose={() => setShowBulletGen(false)}
        onInsertBullet={(bullet) => {
          onResumeChange(resumeText + '\n' + bullet);
        }}
      />

      <LinkedInSyncModal
        isOpen={showLinkedInSync}
        onClose={() => setShowLinkedInSync(false)}
        onImportResume={(imported) => onResumeChange(imported)}
      />
    </div>
  );
}
