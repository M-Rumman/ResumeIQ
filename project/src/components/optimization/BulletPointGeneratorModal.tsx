import { useState } from 'react';
import { X, Sparkles, Copy, Check, Wand2 } from 'lucide-react';

interface BulletPointGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertBullet?: (bullet: string) => void;
}

export default function BulletPointGeneratorModal({
  isOpen,
  onClose,
  onInsertBullet,
}: BulletPointGeneratorModalProps) {
  if (!isOpen) return null;

  const [inputSentence, setInputSentence] = useState('');
  const [objective, setObjective] = useState<'metrics' | 'leadership' | 'tech' | 'efficiency'>('metrics');
  const [targetRole, setTargetRole] = useState('');
  const [generatedBullets, setGeneratedBullets] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = () => {
    const raw = inputSentence.trim();
    if (!raw) return;

    // Clean leading bullets
    const clean = raw.replace(/^[•\-*\d.]+\s*/, '').replace(/^(i\s+|we\s+|responsible\s+for\s+|helped\s+with\s+)/i, '');

    const role = targetRole.trim() || 'team';
    let bullets: string[] = [];

    if (objective === 'metrics') {
      bullets = [
        `Spearheaded ${clean}, boosting operational output by 32% and surpassing quarterly targets.`,
        `Orchestrated ${clean}, delivering an estimated $45,000 in annual cost savings across ${role} workflows.`,
        `Engineered robust processes for ${clean}, scaling user engagement by 40% while preserving 99.9% uptime.`,
      ];
    } else if (objective === 'leadership') {
      bullets = [
        `Directed a cross-functional squad to execute ${clean}, mentoring 4 junior colleagues and accelerating sprint velocity by 25%.`,
        `Mobilized key stakeholders and business partners to champion ${clean}, unifying organizational priorities across departments.`,
        `Championed end-to-end strategic initiatives around ${clean}, establishing standard operating procedures adopted company-wide.`,
      ];
    } else if (objective === 'tech') {
      bullets = [
        `Architected scalable infrastructure to deliver ${clean}, reducing latency by 45% using modern engineering standards.`,
        `Automated continuous integration and deployment pipelines for ${clean}, eliminating manual errors and cutting cycle times by 60%.`,
        `Refactored mission-critical systems supporting ${clean}, fortifying security postures and ensuring strict regulatory compliance.`,
      ];
    } else {
      // efficiency
      bullets = [
        `Streamlined legacy bottlenecks around ${clean}, reducing end-to-end processing turnaround time from 5 days to 4 hours.`,
        `Overhauled recurring administrative workflows for ${clean}, liberating 15 team hours weekly for high-value strategic objectives.`,
        `Standardized operational playbooks for ${clean}, mitigating error rates by 70% across 1,000+ monthly client transactions.`,
      ];
    }

    setGeneratedBullets(bullets);
  };

  const handleCopy = (bullet: string, index: number) => {
    navigator.clipboard.writeText(`• ${bullet}`);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#3c4a59] text-white">
              <Wand2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">AI Bullet Point Generator</h3>
              <p className="text-xs text-gray-500">Transform weak duties into high-impact, quantified achievement statements</p>
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
        <div className="p-6 overflow-y-auto space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1.5">
              Enter your current weak bullet or job duty:
            </label>
            <textarea
              value={inputSentence}
              onChange={(e) => setInputSentence(e.target.value)}
              placeholder="e.g. helped with customer support tickets and solved client problems..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-[#3c4a59]"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-900 mb-1.5">
                Strategic Focus:
              </label>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3c4a59]"
              >
                <option value="metrics">Quantifiable Impact & Growth (% / $)</option>
                <option value="leadership">Leadership & Stakeholder Ownership</option>
                <option value="tech">Engineering, Tech & Scalability</option>
                <option value="efficiency">Process Optimization & Time-Savings</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-900 mb-1.5">
                Target Role / Domain (Optional):
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Software Engineer, Product, Marketing"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3c4a59]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!inputSentence.trim()}
            className="w-full py-3 rounded-xl bg-[#3c4a59] hover:bg-[#2e3a47] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            Generate High-Impact Variations
          </button>

          {/* Generated Results */}
          {generatedBullets.length > 0 && (
            <div className="pt-3 space-y-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                Generated Executive Bullet Options:
              </span>
              {generatedBullets.map((bullet, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <p className="text-sm font-semibold text-emerald-950 flex-1">
                    • {bullet}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCopy(bullet, idx)}
                      className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedIndex === idx ? 'Copied' : 'Copy'}
                    </button>
                    {onInsertBullet && (
                      <button
                        onClick={() => {
                          onInsertBullet(`• ${bullet}`);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm"
                      >
                        Insert
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
