import { AlertTriangle, CheckCircle2, XCircle, ShieldAlert, Sparkles } from 'lucide-react';
import { type AtsFormatReport } from '../../utils/atsFormatScanner';

interface FormattingAlertsCardProps {
  report: AtsFormatReport;
  onRefreshScan?: () => void;
}

export default function FormattingAlertsCard({ report, onRefreshScan }: FormattingAlertsCardProps) {
  const isOptimal = report.status === 'optimal';
  const isCritical = report.status === 'critical_issues';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${
            isOptimal ? 'bg-emerald-50 text-emerald-600' : isCritical ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
          }`}>
            {isOptimal ? <CheckCircle2 className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-gray-900">ATS Layout & Formatting Health</h3>
            <p className="text-xs text-gray-500">Detects unreadable tables, floating text boxes, multi-columns, and unusual font encodings</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className={`text-2xl font-black ${
              report.score >= 85 ? 'text-emerald-600' : report.score >= 65 ? 'text-amber-600' : 'text-rose-600'
            }`}>
              {report.score}%
            </span>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              {isOptimal ? 'ATS Ready' : isCritical ? 'Critical Issues' : 'Needs Review'}
            </p>
          </div>
          {onRefreshScan && (
            <button
              onClick={onRefreshScan}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
            >
              Re-scan
            </button>
          )}
        </div>
      </div>

      {/* Issues list */}
      {report.issues.length > 0 ? (
        <div className="mt-5 space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Detected Formatting Warnings ({report.issues.length})</p>
          {report.issues.map((issue) => {
            const isCrit = issue.severity === 'critical';
            return (
              <div
                key={issue.id}
                className={`rounded-xl p-4 border transition-all ${
                  isCrit ? 'bg-rose-50/70 border-rose-200 text-rose-950' : 'bg-amber-50/70 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex items-start gap-3">
                  {isCrit ? (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-gray-900">{issue.title}</h4>
                      <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide rounded-full ${
                        isCrit ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {issue.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-700 leading-relaxed">{issue.description}</p>
                    <div className="mt-2.5 flex items-start gap-2 bg-white/80 p-2.5 rounded-lg border border-gray-200/60 text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-[#3c4a59] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-gray-900">How to fix: </span>
                        <span className="text-gray-700">{issue.remediation}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-3 text-emerald-900">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-xs font-semibold">Zero formatting blockers detected! Your resume has a clean linear single-column layout.</p>
        </div>
      )}

      {/* Passed Checks checklist */}
      {report.passedChecks.length > 0 && (
        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Verified Safe Elements</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {report.passedChecks.map((check, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-gray-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{check}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
