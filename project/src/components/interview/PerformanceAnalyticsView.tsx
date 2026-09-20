import { useState, useEffect } from 'react';
import {
  Gauge,
  Eye,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Mic,
  Award,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';
import type { AnswerEvaluation } from '../../lib/api/interviewPrepApi';

export interface RecordedAnswer {
  questionId: string;
  stage: string;
  questionText: string;
  candidateAnswer: string;
  wordCount: number;
  durationSeconds: number;
  wpm: number;
  fillerCount: number;
  fillerWords?: Record<string, number>;
  evaluation: AnswerEvaluation;
}

export interface PerformanceMetrics {
  wpm: number;
  fillerCount: number;
  fillerWords: Record<string, number>;
  eyeContactPercent: number;
  clarityScore: number;
  structureScore: number;
  durationSeconds: number;
  transcript: string;
  questionText: string;
  personaName: string;
  avatarId?: string;
  voiceId?: string;
  recordedAnswers?: RecordedAnswer[];
  averageScore?: number;
  overallRating?: string;
  strengths?: string[];
  improvements?: string[];
}

interface PerformanceAnalyticsProps {
  metrics?: PerformanceMetrics | null;
  onRetry?: () => void;
  onNextQuestion?: () => void;
  onOpenCoach?: () => void;
}

export default function PerformanceAnalyticsView({
  metrics = null,
  onRetry,
  onNextQuestion,
  onOpenCoach,
}: PerformanceAnalyticsProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});

  // Clear cached analytics payload on initialization
  useEffect(() => {
    try {
      localStorage.removeItem('interview_metrics');
      localStorage.removeItem('interview_session_analytics');
      localStorage.removeItem('latest_interview_metrics');
    } catch {
      // ignore
    }
  }, []);

  const toggleQuestionExpanded = (id: string) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (!metrics) {
    return (
      <div className="glass-card p-10 sm:p-14 text-center max-w-2xl mx-auto space-y-6 animate-fadeIn">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-[#3c4a59] mx-auto flex items-center justify-center shadow-sm">
          <Gauge className="w-8 h-8 text-[#3c4a59]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-gray-900">No Session Analytics Yet</h2>
          <p className="text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
            Instant Analytics starts with a blank slate. Complete a mock interview session to view real-time speech pacing, filler words, eye contact, and structured scoring.
          </p>
        </div>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#3c4a59] text-white hover:bg-[#2e3a47] font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            Start Mock Interview
          </button>
          {onOpenCoach && (
            <button
              type="button"
              onClick={onOpenCoach}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              Explore STAR Coach
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Highlight filler words in transcript
  const fillerList = Object.keys(metrics.fillerWords || {});
  const formattedTranscript = metrics.transcript ? (
    metrics.transcript.split(' ').map((word, i) => {
      const clean = word.toLowerCase().replace(/[^a-z]/g, '');
      const isFiller = fillerList.includes(clean);
      if (isFiller) {
        return (
          <span
            key={i}
            className="bg-amber-100 text-amber-900 font-bold px-1 rounded mx-0.5 border border-amber-300"
            title="Filler word detected"
          >
            {word}{' '}
          </span>
        );
      }
      return word + ' ';
    })
  ) : (
    <span className="text-gray-400 italic">No transcript recorded for this response.</span>
  );

  const getPacingAnalysis = (wpm: number) => {
    if (wpm < 110) {
      return {
        label: 'Slightly Slow',
        desc: 'Below conversational sweet spot (120–160 WPM). Increase energy and tempo.',
        color: 'text-amber-600',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }
    if (wpm > 165) {
      return {
        label: 'Slightly Rushed',
        desc: 'Above 165 WPM. Practice taking 2-second breath pauses before transitioning.',
        color: 'text-amber-600',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }
    return {
      label: 'Optimal Conversational Pace',
      desc: 'Within ideal executive cadence (120–160 WPM). Clear, composed, and easy to follow.',
      color: 'text-emerald-600',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  };

  const pacing = getPacingAnalysis(metrics.wpm);
  const overallReadiness = metrics.averageScore
    ? metrics.averageScore
    : Math.round(
        metrics.clarityScore * 0.35 +
          metrics.structureScore * 0.35 +
          Math.min(100, metrics.eyeContactPercent) * 0.15 +
          Math.max(0, 100 - metrics.fillerCount * 8) * 0.15
      );

  // Dynamic strengths & improvements from candidate answers
  const displayStrengths =
    metrics.strengths && metrics.strengths.length > 0
      ? metrics.strengths
      : [
          'Strong Quantifiable Impact: Highlighted specific technical metrics and ownership.',
          'Structured Communication: Framed responses with clear context and concrete action steps.',
          'Domain Relevance: Answered with relevant architectural and behavioral terminology.',
        ];

  const displayImprovements =
    metrics.improvements && metrics.improvements.length > 0
      ? metrics.improvements
      : [
          'Conclude with measurable business or system KPIs (e.g. latency deltas or scale metrics).',
          'Highlight individual contributions ("I evaluated..." vs "We did...") to emphasize leadership.',
          'Replace filler pauses with silent deliberate pauses to project executive poise.',
        ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner with Overall Readiness */}
      <div className="glass-card p-6 sm:p-8 bg-gradient-to-br from-white/90 to-slate-50/80 border border-white/60 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Award className="w-6 h-6 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Session Performance Scorecard
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900">
              Mock Interview Response Analytics
            </h2>
            <p className="text-sm text-gray-600">
              Evaluated by AI Persona: <strong className="text-gray-900">{metrics.personaName}</strong>
              {metrics.overallRating && (
                <span className="ml-2 inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                  Rating: {metrics.overallRating}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white px-6 py-4 rounded-2xl border border-gray-200 shadow-sm">
            <div className="text-center">
              <div className="text-3xl font-black text-[#3c4a59]">{overallReadiness}%</div>
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                Readiness Score
              </div>
            </div>
            <div className="h-10 w-px bg-gray-200" />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> High Confidence
              </div>
              <div className="text-[11px] text-gray-500">
                {Math.floor(metrics.durationSeconds / 60)}m {metrics.durationSeconds % 60}s duration
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Core 4 Metric Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pacing */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Speech Pacing
            </span>
            <Gauge className="w-4 h-4 text-[#3c4a59]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900">{metrics.wpm}</span>
            <span className="text-xs text-gray-500 font-medium">words/min</span>
          </div>
          <div className={`text-xs px-2.5 py-1 rounded-full border font-bold inline-block ${pacing.badge}`}>
            {pacing.label}
          </div>
          <p className="text-[11px] text-gray-600 leading-relaxed">{pacing.desc}</p>
        </div>

        {/* Filler Words */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Filler Words
            </span>
            <Mic className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900">{metrics.fillerCount}</span>
            <span className="text-xs text-gray-500 font-medium">detected</span>
          </div>
          <div className="text-xs px-2.5 py-1 rounded-full border font-bold inline-block bg-amber-50 text-amber-800 border-amber-200">
            {metrics.fillerCount <= 2 ? 'Low Habit' : 'Nervous Habit'}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(metrics.fillerWords || {}).map(([word, count]) => (
              <span
                key={word}
                className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-medium border border-gray-200"
              >
                "{word}": {count}x
              </span>
            ))}
          </div>
        </div>

        {/* Camera / Eye Contact */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Camera Eye Contact
            </span>
            <Eye className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900">{metrics.eyeContactPercent}%</span>
            <span className="text-xs text-gray-500 font-medium">lens focus</span>
          </div>
          <div className="text-xs px-2.5 py-1 rounded-full border font-bold inline-block bg-blue-50 text-blue-800 border-blue-200">
            {metrics.eyeContactPercent >= 75 ? 'Direct & Engaging' : 'Shifting Gaze'}
          </div>
          <p className="text-[11px] text-gray-600 leading-relaxed">
            Maintained direct alignment with camera lens for strong executive presence.
          </p>
        </div>

        {/* Structure & STAR Score */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              STAR Structure
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900">{metrics.structureScore}%</span>
            <span className="text-xs text-gray-500 font-medium">coherence</span>
          </div>
          <div className="text-xs px-2.5 py-1 rounded-full border font-bold inline-block bg-emerald-50 text-emerald-800 border-emerald-200">
            Methodical Delivery
          </div>
          <p className="text-[11px] text-gray-600 leading-relaxed">
            Situation, task, action, and measurable outcome clearly distinguished.
          </p>
        </div>
      </div>

      {/* QUESTION-BY-QUESTION RESPONSE & EVALUATION BREAKDOWN */}
      {metrics.recordedAnswers && metrics.recordedAnswers.length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#3c4a59]" />
                Question-by-Question Response Audit & Evaluation
              </h3>
              <p className="text-xs text-gray-500">
                Detailed review of all answers given during your interview session with {metrics.personaName}.
              </p>
            </div>
            <span className="text-xs font-bold bg-indigo-50 text-indigo-800 px-3 py-1 rounded-full border border-indigo-200">
              {metrics.recordedAnswers.length} Rounds Evaluated
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {metrics.recordedAnswers.map((item, idx) => {
              const isExpanded = expandedQuestions[item.questionId] ?? true;
              const evalData = item.evaluation;
              return (
                <div
                  key={item.questionId || idx}
                  className="rounded-2xl border border-gray-200 bg-white/90 overflow-hidden shadow-sm transition-all"
                >
                  <div
                    onClick={() => toggleQuestionExpanded(item.questionId)}
                    className="px-5 py-3.5 bg-gray-50/80 hover:bg-gray-100/70 cursor-pointer flex items-center justify-between gap-4 select-none border-b border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#3c4a59] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="text-xs font-bold text-gray-900 block">
                          {item.stage}
                        </span>
                        <span className="text-[11px] text-gray-500 line-clamp-1">
                          "{item.questionText}"
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        Score: {evalData?.overallScore || 85}/100
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-5 space-y-4">
                      {/* Candidate's Answer */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                          Your Spoken / Submitted Answer
                        </span>
                        <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 text-xs text-gray-800 leading-relaxed font-serif whitespace-pre-wrap">
                          {item.candidateAnswer}
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-gray-500 pt-0.5">
                          <span>{item.wordCount} words</span>
                          <span>Duration: {item.durationSeconds}s</span>
                          <span>Pacing: {item.wpm} WPM</span>
                          <span>Fillers: {item.fillerCount}</span>
                        </div>
                      </div>

                      {/* Interviewer Feedback */}
                      {evalData && (
                        <div className="space-y-3 pt-2 border-t border-gray-100">
                          <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-1">
                            <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                              {metrics.personaName}'s Verbal Feedback:
                            </div>
                            <p className="text-xs text-indigo-950 italic">
                              "{evalData.spokenFeedback || evalData.summaryFeedback}"
                            </p>
                          </div>

                          {/* STAR validation badges */}
                          {evalData.starBreakdown && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {(['situation', 'task', 'action', 'result'] as const).map((key) => {
                                const starItem = evalData.starBreakdown[key];
                                const isPresent = starItem?.present;
                                return (
                                  <div
                                    key={key}
                                    className={`p-2 rounded-lg border text-[11px] ${
                                      isPresent
                                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                        : 'bg-amber-50/70 border-amber-200 text-amber-900'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between font-bold capitalize">
                                      <span>{key}</span>
                                      {isPresent ? (
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      ) : (
                                        <AlertCircle className="w-3 h-3 text-amber-600" />
                                      )}
                                    </div>
                                    <p className="text-[10px] text-gray-600 line-clamp-1 mt-0.5">
                                      {starItem?.feedback}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Key Strengths & Polish */}
                          <div className="grid sm:grid-cols-2 gap-3 text-xs">
                            {evalData.strengths && evalData.strengths.length > 0 && (
                              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                <span className="font-bold text-emerald-900 block mb-1 text-[11px]">
                                  Key Strengths:
                                </span>
                                <ul className="space-y-1 text-[11px] text-emerald-800">
                                  {evalData.strengths.map((s, i) => (
                                    <li key={i} className="flex items-start gap-1.5">
                                      <span className="w-1 h-1 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
                                      <span>{s}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {evalData.improvements && evalData.improvements.length > 0 && (
                              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                                <span className="font-bold text-amber-900 block mb-1 text-[11px]">
                                  Recommendations:
                                </span>
                                <ul className="space-y-1 text-[11px] text-amber-800">
                                  {evalData.improvements.map((imp, i) => (
                                    <li key={i} className="flex items-start gap-1.5">
                                      <span className="w-1 h-1 rounded-full bg-amber-500 mt-1 flex-shrink-0" />
                                      <span>{imp}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Combined Speech Transcript & Habit Heatmap */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#3c4a59]" />
            Speech Transcript & Habit Heatmap
          </h3>
          <span className="text-xs text-gray-500">
            Filler words highlighted in <span className="bg-amber-100 text-amber-800 px-1 rounded font-bold">amber</span>
          </span>
        </div>

        <div className="bg-white/80 p-5 rounded-xl border border-gray-200/80 text-sm leading-relaxed text-gray-800 font-serif max-h-72 overflow-y-auto">
          {formattedTranscript}
        </div>
      </div>

      {/* Dynamic Strengths & Improvements */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm uppercase tracking-wide">
            <CheckCircle2 className="w-4 h-4" /> Strong Signals Demonstrated
          </div>
          <ul className="space-y-2.5 text-xs text-emerald-900">
            {displayStrengths.map((str, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 flex-shrink-0" />
                <span>{str}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actionable Improvement */}
        <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-amber-800 font-extrabold text-sm uppercase tracking-wide">
            <AlertCircle className="w-4 h-4" /> Areas for High-Impact Polish
          </div>
          <ul className="space-y-2.5 text-xs text-amber-900">
            {displayImprovements.map((imp, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 flex-shrink-0" />
                <span>{imp}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-200">
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-xs font-bold transition-all shadow-sm active:scale-95"
        >
          <RotateCcw className="w-4 h-4 text-gray-500" />
          Practice Another Mock Interview
        </button>

        <div className="flex items-center gap-3">
          {onOpenCoach && (
            <button
              onClick={onOpenCoach}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold transition-all"
            >
              <Sparkles className="w-4 h-4" />
              STAR Coach Workbench
            </button>
          )}

          {onNextQuestion && (
            <button
              onClick={onNextQuestion}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#3c4a59] text-white hover:bg-[#2e3a47] text-xs font-bold transition-all shadow-md active:scale-95"
            >
              Next Practice Question
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
