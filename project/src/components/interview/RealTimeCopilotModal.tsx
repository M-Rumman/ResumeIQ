import { useState } from 'react';
import {
  Sparkles,
  Zap,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Volume2,
  X,
  Minimize2,
  Maximize2,
  HelpCircle,
  Clock,
} from 'lucide-react';

interface RealTimeCopilotProps {
  isOpen: boolean;
  onClose: () => void;
  currentQuestion?: string;
  questionTip?: string;
  transcript?: string;
  wpm?: number;
  fillerWordCount?: number;
  recentFillerWords?: string[];
  suggestedPoints?: string[];
}

export default function RealTimeCopilotModal({
  isOpen,
  onClose,
  currentQuestion = 'Tell me about a complex technical challenge you solved and how you approached it.',
  questionTip = 'Lead with the high-level business impact, then break down the architecture trade-offs and your specific code contributions using the STAR framework.',
  transcript = '',
  wpm = 135,
  fillerWordCount = 1,
  recentFillerWords = ['um'],
  suggestedPoints = [
    'Define the business constraint or performance bottleneck clearly (Situation)',
    'Specify your role versus the broader team (Task)',
    'Highlight key trade-offs: latency vs throughput, consistency vs availability (Action)',
    'End with concrete metrics: e.g., reduced response times by 40% (Result)',
  ],
}: RealTimeCopilotProps) {
  const [minimized, setMinimized] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(false);

  if (!isOpen) return null;

  // Auto-detect STAR pillars from transcript keywords
  const lowerTranscript = transcript.toLowerCase();
  const hasSituation =
    lowerTranscript.includes('situation') ||
    lowerTranscript.includes('context') ||
    lowerTranscript.includes('problem') ||
    lowerTranscript.includes('when i was') ||
    lowerTranscript.includes('our team was');
  const hasTask =
    lowerTranscript.includes('task') ||
    lowerTranscript.includes('goal') ||
    lowerTranscript.includes('responsible for') ||
    lowerTranscript.includes('needed to') ||
    lowerTranscript.includes('my objective');
  const hasAction =
    lowerTranscript.includes('action') ||
    lowerTranscript.includes('i implemented') ||
    lowerTranscript.includes('i built') ||
    lowerTranscript.includes('i designed') ||
    lowerTranscript.includes('step') ||
    lowerTranscript.includes('i investigated');
  const hasResult =
    lowerTranscript.includes('result') ||
    lowerTranscript.includes('percent') ||
    lowerTranscript.includes('%') ||
    lowerTranscript.includes('outcome') ||
    lowerTranscript.includes('improved') ||
    lowerTranscript.includes('reduced');

  const starPillars = [
    { label: 'Situation (Context & Scale)', active: hasSituation },
    { label: 'Task (Your Specific Goal)', active: hasTask },
    { label: 'Action (Concrete Steps "I" took)', active: hasAction },
    { label: 'Result (Metrics & Business Impact)', active: hasResult },
  ];

  const getPacingBadge = (speed: number) => {
    if (speed === 0) return { text: 'Listening...', color: 'bg-gray-100 text-gray-700' };
    if (speed < 110) return { text: `${speed} WPM · Slow Pacing`, color: 'bg-amber-100 text-amber-800' };
    if (speed > 165) return { text: `${speed} WPM · Rushing, Slow Down`, color: 'bg-red-100 text-red-800' };
    return { text: `${speed} WPM · Optimal Pacing`, color: 'bg-emerald-100 text-emerald-800' };
  };

  const pacingInfo = getPacingBadge(wpm);

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ${
        minimized
          ? 'bottom-6 right-6 w-80 shadow-2xl'
          : 'bottom-6 right-6 sm:right-10 w-[94vw] sm:w-[460px] max-h-[85vh] shadow-2xl'
      }`}
    >
      <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl overflow-hidden text-white flex flex-col shadow-2xl ring-1 ring-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold tracking-wide uppercase text-slate-200">
                Live Interview Copilot
              </span>
            </div>
            <span className="text-[10px] bg-indigo-500/30 text-indigo-300 font-semibold px-2 py-0.5 rounded-full border border-indigo-500/40">
              Teleprompter
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMinimized(!minimized)}
              className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
              title={minimized ? 'Expand Teleprompter' : 'Minimize to compact widget'}
            >
              {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Close Copilot"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Minimized Quick Status Bar */}
        {minimized ? (
          <div className="p-3 bg-slate-950/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${pacingInfo.color}`}>
                {pacingInfo.text}
              </span>
              <span className="text-slate-400">
                Fillers: <strong className="text-amber-400">{fillerWordCount}</strong>
              </span>
            </div>
            <button
              onClick={() => setMinimized(false)}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2"
            >
              Show Hints
            </button>
          </div>
        ) : (
          <div className="p-4 overflow-y-auto space-y-4 max-h-[72vh] text-xs">
            {/* Live Metrics Row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2.5 flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Speech Pacing
                  </div>
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5 mt-0.5">
                    <span className={`px-1.5 py-0.2 rounded text-[10px] ${pacingInfo.color}`}>
                      {wpm > 0 ? `${wpm} WPM` : 'Ready'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2.5 flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Filler Words
                  </div>
                  <div className="text-xs font-bold text-slate-100 mt-0.5">
                    {fillerWordCount === 0 ? (
                      <span className="text-emerald-400 font-medium">Clean delivery (0)</span>
                    ) : (
                      <span className="text-amber-300 font-medium">
                        {fillerWordCount} count ({recentFillerWords.slice(-2).join(', ')})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Current Question */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                Active Interview Prompt
              </div>
              <p className="text-sm font-semibold text-slate-100 leading-snug">
                "{currentQuestion}"
              </p>
            </div>

            {/* STAR Structure Checklist */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Live STAR Progression Checklist
                </span>
                <span className="text-[10px] text-slate-400">
                  {starPillars.filter((p) => p.active).length} / 4 Covered
                </span>
              </div>
              <div className="space-y-1.5">
                {starPillars.map((p, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      p.active
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 font-medium'
                        : 'bg-slate-900/40 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {p.active ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    )}
                    <span>{p.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Talking Points & Hints */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Suggested Talking Points
                </span>
                {!hintsRevealed && (
                  <button
                    onClick={() => setHintsRevealed(true)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2"
                  >
                    Reveal Prompts
                  </button>
                )}
              </div>

              {hintsRevealed ? (
                <div className="space-y-2">
                  <ul className="space-y-1.5 text-slate-300 text-[11px]">
                    {suggestedPoints.map((pt, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                  {questionTip && (
                    <div className="mt-2 pt-2 border-t border-slate-700/60 text-[11px] text-slate-400 italic">
                      💡 Pro Tip: {questionTip}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Stuck or experiencing interview anxiety? Click "Reveal Prompts" above to view suggested frameworks and keywords.
                </p>
              )}
            </div>

            {/* Live Transcript Preview */}
            {transcript && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Transcribed Speech Preview
                </div>
                <p className="text-[11px] text-slate-300 italic line-clamp-3">
                  "{transcript}"
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
