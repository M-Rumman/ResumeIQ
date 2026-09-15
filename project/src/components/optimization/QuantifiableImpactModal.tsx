import { useState } from 'react';
import { X, TrendingUp, Check, HelpCircle } from 'lucide-react';
import { findUnquantifiedBullets } from '../../utils/quantifiableImpactChecker';

interface QuantifiableImpactModalProps {
  resumeText: string;
  isOpen: boolean;
  onClose: () => void;
  onApplyBullet: (oldBullet: string, newBullet: string) => void;
}

export default function QuantifiableImpactModal({
  resumeText,
  isOpen,
  onClose,
  onApplyBullet,
}: QuantifiableImpactModalProps) {
  if (!isOpen) return null;

  const unquantifiedList = findUnquantifiedBullets(resumeText);
  const [selectedBulletIndex, setSelectedBulletIndex] = useState<number>(0);
  const [customMetricInput, setCustomMetricInput] = useState<string>('');

  const current = unquantifiedList[selectedBulletIndex];

  const handleApply = (newText: string) => {
    if (!current) return;
    onApplyBullet(current.originalText, newText);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">Quantifiable Impact Assistant</h3>
              <p className="text-xs text-gray-500">Inject measurable outcomes and Google XYZ formula metrics into weak bullets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {unquantifiedList.length > 0 && current ? (
            <>
              {/* Bullet Selector Bar */}
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                  Unquantified Bullets ({unquantifiedList.length})
                </span>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {unquantifiedList.map((item, idx) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedBulletIndex(idx);
                        setCustomMetricInput('');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors ${
                        selectedBulletIndex === idx
                          ? 'bg-[#3c4a59] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Bullet #{idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Original Bullet */}
              <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 text-xs">
                <span className="font-bold text-rose-800 uppercase tracking-wider text-[10px] block mb-1">
                  Original Sentence (Needs Quantification)
                </span>
                <p className="text-sm font-medium text-rose-950">{current.originalText}</p>
              </div>

              {/* Guided AI Prompt Questionnaire */}
              <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100 space-y-4">
                <div className="flex items-center gap-2 text-[#3c4a59]">
                  <HelpCircle className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">AI Impact Questionnaire</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1">
                    {current.promptQuestion}
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Example: <span className="font-semibold text-emerald-700">{current.exampleMetric}</span>
                  </p>
                  <input
                    type="text"
                    value={customMetricInput}
                    onChange={(e) => setCustomMetricInput(e.target.value)}
                    placeholder={`e.g. ${current.exampleMetric}`}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3c4a59]"
                  />
                </div>
              </div>

              {/* Generated XYZ Formula Templates */}
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3">
                  Recommended High-Impact Rewrites (Click to apply)
                </span>
                <div className="space-y-3">
                  {current.generatedXyzTemplates.map((template, idx) => {
                    const filled = customMetricInput.trim()
                      ? template.replace(current.exampleMetric, customMetricInput.trim())
                      : template;

                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex-1">
                          <span className="text-[10px] font-extrabold uppercase text-emerald-700 block mb-1">
                            Formula Variation {idx + 1}
                          </span>
                          <p className="text-sm font-semibold text-emerald-950">
                            • {filled}
                          </p>
                        </div>
                        <button
                          onClick={() => handleApply(`• ${filled}`)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 active:scale-95 transition-all shadow-sm"
                        >
                          Apply to Resume
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center bg-emerald-50 rounded-2xl border border-emerald-100">
              <Check className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <h4 className="text-base font-black text-emerald-950">Outstanding Quantification!</h4>
              <p className="text-xs text-emerald-800 mt-1 max-w-md mx-auto">
                All bullet points in your resume contain quantified metrics, numbers, percentages, or dollar amounts.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
