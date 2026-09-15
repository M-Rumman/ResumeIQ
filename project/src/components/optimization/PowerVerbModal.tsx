import { useState } from 'react';
import { X, Check, Zap } from 'lucide-react';
import { findWeakPhrases, replaceWeakPhrase, POWER_VERB_TAXONOMY, type WeakPhraseMatch } from '../../utils/powerVerbEngine';

interface PowerVerbModalProps {
  resumeText: string;
  isOpen: boolean;
  onClose: () => void;
  onApplyReplacement: (newResumeText: string) => void;
}

export default function PowerVerbModal({
  resumeText,
  isOpen,
  onClose,
  onApplyReplacement,
}: PowerVerbModalProps) {
  if (!isOpen) return null;

  const weakMatches = findWeakPhrases(resumeText);
  const [copiedVerb, setCopiedVerb] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number>(0);

  const handleApply = (match: WeakPhraseMatch, replacementVerb: string) => {
    const updated = replaceWeakPhrase(resumeText, match.startIndex, match.endIndex, replacementVerb);
    onApplyReplacement(updated);
  };

  const handleCopy = (verb: string) => {
    navigator.clipboard.writeText(verb);
    setCopiedVerb(verb);
    setTimeout(() => setCopiedVerb(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">Power Verb Suggestions</h3>
              <p className="text-xs text-gray-500">Replace weak or passive phrasing with high-impact executive verbs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Section 1: Detected Passive / Weak Phrases in current resume */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-gray-900">
                Detected in Your Resume ({weakMatches.length})
              </h4>
              <span className="text-xs text-gray-500">Click any verb to replace in 1-click</span>
            </div>

            {weakMatches.length > 0 ? (
              <div className="space-y-3">
                {weakMatches.map((m) => (
                  <div key={m.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 text-xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">Weak phrase:</span>
                        <span className="font-semibold text-rose-900 line-through">"{m.foundText}"</span>
                      </div>
                      <span className="text-[11px] text-gray-500 italic">in: "{m.sentence.slice(0, 45)}..."</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] font-bold text-gray-700">Recommended 1-click swap:</span>
                      {m.recommendedVerbs.map((verb) => (
                        <button
                          key={verb}
                          onClick={() => handleApply(m, verb)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm hover:shadow active:scale-95 transition-all"
                        >
                          Use "{verb}"
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-900 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>No common passive phrases found in your resume text. Great active voice!</span>
              </div>
            )}
          </div>

          {/* Section 2: Power Verb Dictionary by Category */}
          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-sm font-bold text-gray-900 mb-2">Power Verb Library by Leadership Category</h4>
            <p className="text-xs text-gray-500 mb-4">Explore high-frequency action verbs tailored to your field of work.</p>

            {/* Category tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {POWER_VERB_TAXONOMY.map((cat, idx) => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    selectedCategory === idx
                      ? 'bg-[#3c4a59] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Category card */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <p className="text-xs text-gray-600 mb-3">{POWER_VERB_TAXONOMY[selectedCategory].description}</p>
              <div className="flex flex-wrap gap-2">
                {POWER_VERB_TAXONOMY[selectedCategory].verbs.map((verb) => (
                  <button
                    key={verb}
                    onClick={() => handleCopy(verb)}
                    className="group relative px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-800 hover:border-[#3c4a59] hover:text-[#3c4a59] shadow-sm transition-all"
                  >
                    {verb}
                    {copiedVerb === verb && (
                      <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                        Copied!
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

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
