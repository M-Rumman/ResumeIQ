import { Sparkles, CheckCircle2, XCircle, Zap, Shield, FileText } from 'lucide-react';
import { type RealTimeScoreReport } from '../../utils/realtimeScorer';

interface RealTimeScoreDashboardProps {
  report: RealTimeScoreReport;
  onOpenImpactPrompts?: () => void;
  onOpenPowerVerbs?: () => void;
}

export default function RealTimeScoreDashboard({
  report,
  onOpenImpactPrompts,
  onOpenPowerVerbs,
}: RealTimeScoreDashboardProps) {
  const getGradeColor = (grade: RealTimeScoreReport['grade']) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'B':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'C':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-rose-50 text-rose-700 border-rose-200';
    }
  };

  const getPillarColor = (score: number) => {
    if (score >= 22) return 'bg-emerald-500';
    if (score >= 16) return 'bg-blue-500';
    if (score >= 12) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const pillarsList = [
    { key: 'impact', data: report.pillars.impact, icon: Zap, actionLabel: 'Add Metrics', onAction: onOpenImpactPrompts },
    { key: 'brevity', data: report.pillars.brevity, icon: FileText },
    { key: 'style', data: report.pillars.style, icon: Sparkles, actionLabel: 'Power Verbs', onAction: onOpenPowerVerbs },
    { key: 'structure', data: report.pillars.structure, icon: Shield },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6">
      {/* Top Banner with Overall Score & Live Stats */}
      <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#3c4a59] to-[#252f38] text-white shadow-md">
            <div className="text-center">
              <span className="text-3xl font-black leading-none">{report.overallScore}</span>
              <span className="block text-[10px] font-semibold text-gray-300">/ 100</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-gray-900">Live Resume Quality Grade</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${getGradeColor(report.grade)}`}>
                Grade {report.grade}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Recalculated instantly as you type • 4-Pillar ATS & Recruiter Readiness
            </p>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="bg-gray-50 px-3 py-2 rounded-xl border border-gray-100 text-center min-w-20">
            <span className="block text-sm font-black text-gray-900">{report.metricsCount}</span>
            <span className="text-[10px] text-gray-500 font-medium">Metrics Used</span>
          </div>
          <div className="bg-gray-50 px-3 py-2 rounded-xl border border-gray-100 text-center min-w-20">
            <span className="block text-sm font-black text-gray-900">{report.activeVoicePercentage}%</span>
            <span className="text-[10px] text-gray-500 font-medium">Active Voice</span>
          </div>
          <div className="bg-gray-50 px-3 py-2 rounded-xl border border-gray-100 text-center min-w-20">
            <span className="block text-sm font-black text-gray-900">{report.wordCount}</span>
            <span className="text-[10px] text-gray-500 font-medium">Words</span>
          </div>
          <div className="bg-gray-50 px-3 py-2 rounded-xl border border-gray-100 text-center min-w-20">
            <span className="block text-sm font-black text-gray-900">{report.readingTimeMinutes}m</span>
            <span className="text-[10px] text-gray-500 font-medium">Read Time</span>
          </div>
        </div>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {pillarsList.map(({ key, data, icon: Icon, actionLabel, onAction }) => (
          <div key={key} className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Icon className="w-4 h-4 text-[#3c4a59]" />
                  <span className="text-xs font-bold uppercase tracking-wider">{data.name}</span>
                </div>
                <span className="text-xs font-black text-gray-900">{data.score} / 25</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mb-2.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${getPillarColor(data.score)}`}
                  style={{ width: `${(data.score / 25) * 100}%` }}
                />
              </div>

              <p className="text-xs text-gray-700 leading-snug">{data.feedback}</p>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200/60 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-500 line-clamp-1">{data.actionableTip}</span>
              {actionLabel && onAction && (
                <button
                  type="button"
                  onClick={onAction}
                  className="text-[10px] font-bold text-[#3c4a59] hover:text-[#252f38] underline shrink-0 ml-2"
                >
                  {actionLabel}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Checklist */}
      {report.quickChecklist.length > 0 && (
        <div className="pt-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Live Readiness Checklist</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {report.quickChecklist.map((item, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs transition-colors ${
                  item.passed ? 'bg-emerald-50/50 border-emerald-100 text-emerald-950' : 'bg-gray-50 border-gray-100 text-gray-600'
                }`}
              >
                {item.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-400 shrink-0" />
                )}
                <span className={item.passed ? 'font-medium' : ''}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
