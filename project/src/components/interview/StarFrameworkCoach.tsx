import { useState } from 'react';
import {
  Star,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';

interface MethodGuide {
  id: string;
  name: string;
  acronym: string;
  description: string;
  bestFor: string;
  steps: Array<{ letter: string; name: string; desc: string; example: string }>;
}

const FRAMEWORK_GUIDES: MethodGuide[] = [
  {
    id: 'star',
    name: 'STAR Method',
    acronym: 'Situation · Task · Action · Result',
    description: 'The golden standard across Amazon, Google, Meta, and Fortune 500 behavioral rounds.',
    bestFor: 'Complex engineering challenges, incident response, leadership, and conflict resolution.',
    steps: [
      {
        letter: 'S',
        name: 'Situation',
        desc: 'Set the scene in 20 seconds: company context, stakes, timeline, and constraints.',
        example: 'At FinTechCorp, our payment processing throughput dropped by 45% during peak trading hours.',
      },
      {
        letter: 'T',
        name: 'Task',
        desc: 'Define your exact responsibility. What specific outcome were YOU tasked with delivering?',
        example: 'As tech lead on-call, I needed to restore sub-200ms latency without dropping in-flight transactions.',
      },
      {
        letter: 'A',
        name: 'Action',
        desc: 'The meat of the answer (50% of time). Detail the specific steps YOU took and trade-offs navigated.',
        example: 'I profiled thread dumps in Datadog, pinpointed a connection pool leak in our ORM, and deployed a connection-pooling fix in 18 minutes.',
      },
      {
        letter: 'R',
        name: 'Result',
        desc: 'Quantifiable metrics and business outcomes (%, $, latency, uptime, post-mortem guardrails).',
        example: 'Reduced P99 latency from 1.8s to 120ms, saved an estimated $320k in lost volume, and introduced automated load tests.',
      },
    ],
  },
  {
    id: 'prep',
    name: 'PREP Framework',
    acronym: 'Point · Reason · Example · Point',
    description: 'Fast, punchy executive communication ideal for HR screener and opinion-based prompts.',
    bestFor: 'Questions like "Why React over Vue?", "What is your management philosophy?", or "Why our company?".',
    steps: [
      {
        letter: 'P',
        name: 'Point',
        desc: 'State your main thesis directly in the very first sentence.',
        example: 'I prioritize automated integration testing over 100% unit test coverage for microservices.',
      },
      {
        letter: 'R',
        name: 'Reason',
        desc: 'Explain the core logic or principle underpinning your stance.',
        example: 'Because real-world failures almost always occur at network boundaries and serialization layers.',
      },
      {
        letter: 'E',
        name: 'Example',
        desc: 'Provide a concrete mini-case study illustrating your thesis.',
        example: 'On our checkout migration, unit tests passed 100% while an unverified schema change broke Stripe webhooks.',
      },
      {
        letter: 'P',
        name: 'Point',
        desc: 'Reiterate your core takeaway with a forward-looking conclusion.',
        example: 'That is why end-to-end integration contracts deliver significantly higher ROI for fast-shipping teams.',
      },
    ],
  },
  {
    id: 'car',
    name: 'CAR Framework',
    acronym: 'Context · Action · Result',
    description: 'Streamlined alternative to STAR that blends Situation and Task for faster pacing.',
    bestFor: 'Fast-paced phone screens and speed interviews where brevity is critical.',
    steps: [
      {
        letter: 'C',
        name: 'Context',
        desc: 'Briefly state the challenge and your role in one combined sentence.',
        example: 'When our mobile API crashed under sudden holiday traffic, I was responsible for rapid triage.',
      },
      {
        letter: 'A',
        name: 'Action',
        desc: 'Explain the architectural fix and mitigation steps you spearheaded.',
        example: 'I implemented Redis rate-limiting buckets and enabled aggressive CDN edge caching.',
      },
      {
        letter: 'R',
        name: 'Result',
        desc: 'Highlight the uptime recovery and long-term improvements.',
        example: 'Traffic stabilized within 6 minutes and API reliability held at 99.98% throughout the season.',
      },
    ],
  },
];

export default function StarFrameworkCoach() {
  const [selectedMethod, setSelectedMethod] = useState<string>('star');

  // Interactive STAR Builder State
  const [situation, setSituation] = useState('');
  const [task, setTask] = useState('');
  const [action, setAction] = useState('');
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);

  // Rubric Evaluation Heuristics
  const evalSituation = (text: string) => {
    if (!text.trim()) return { score: 0, tip: 'Describe the context and stakes.' };
    const words = text.trim().split(/\s+/).length;
    if (words < 12) return { score: 50, tip: 'Add more scale details (e.g. team size, timeline, constraint).' };
    return { score: 100, tip: 'Good context setting!' };
  };

  const evalTask = (text: string) => {
    if (!text.trim()) return { score: 0, tip: 'Clarify what YOU specifically were responsible for.' };
    const words = text.trim().split(/\s+/).length;
    if (words < 8) return { score: 50, tip: 'Clearly delineate your mandate versus the broader group.' };
    return { score: 100, tip: 'Clear responsibility established!' };
  };

  const evalAction = (text: string) => {
    if (!text.trim()) return { score: 0, tip: 'Detail your exact steps and decisions.' };
    const words = text.trim().split(/\s+/).length;
    const lower = text.toLowerCase();
    const hasI = lower.includes('i ') || lower.includes("i've") || lower.includes('my ');
    if (words < 20) return { score: 50, tip: 'Expand on the specific technical or interpersonal actions taken.' };
    if (!hasI) return { score: 70, tip: 'Emphasize "I" instead of "we" to spotlight your individual contribution.' };
    return { score: 100, tip: 'Strong active ownership demonstrated!' };
  };

  const evalResult = (text: string) => {
    if (!text.trim()) return { score: 0, tip: 'Include quantifiable numbers or long-term fixes.' };
    const hasNumbers = /\d+|%|\$|saved|improved|reduced/i.test(text);
    if (!hasNumbers) return { score: 60, tip: 'Critical: Add concrete numbers (e.g., % latency drop, $ saved, hours).' };
    return { score: 100, tip: 'Excellent metric-driven result!' };
  };

  const sEval = evalSituation(situation);
  const tEval = evalTask(task);
  const aEval = evalAction(action);
  const rEval = evalResult(result);

  const totalScore = Math.round((sEval.score + tEval.score + aEval.score + rEval.score) / 4);

  const fullCompiledAnswer = [
    situation ? `[Situation] ${situation}` : '',
    task ? `[Task] ${task}` : '',
    action ? `[Action] ${action}` : '',
    result ? `[Result] ${result}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const handleCopy = () => {
    if (!fullCompiledAnswer) return;
    navigator.clipboard.writeText(fullCompiledAnswer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoadSample = () => {
    setSituation(
      'During our annual Black Friday rush at Shopify, our primary checkout API experienced an unexpected 400% surge in latency, threatening over $2M in cart conversions.'
    );
    setTask(
      'As on-call backend tech lead, my mandate was to identify the root cause within 15 minutes and stabilize transaction throughput without incurring data inconsistency.'
    );
    setAction(
      'I immediately analyzed distributed traces in OpenTelemetry and discovered a database lock contention on an unindexed customer loyalty table. I deployed an emergency config toggle to bypass non-critical loyalty point checks, scaled the read replicas by 3x, and established 10-minute executive status updates.'
    );
    setResult(
      'Checkout latency dropped from 2.4 seconds back to 110ms within 9 minutes. We processed a record $4.8M in sales with zero failed transactions, and my subsequent post-mortem led to automated index linting across all production DB migrations.'
    );
  };

  const currentMethodGuide =
    FRAMEWORK_GUIDES.find((m) => m.id === selectedMethod) || FRAMEWORK_GUIDES[0];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="glass-card p-6 sm:p-8 space-y-3">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Answering Methodology Mastery
          </span>
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900">
          Actionable Framework Coach
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">
          Learn the structured frameworks used by top candidates to deliver compelling, concise, and metric-backed interview responses. Test and score your answers with our real-time rubric evaluator.
        </p>
      </div>

      {/* Framework Selector Tabs */}
      <div className="grid sm:grid-cols-3 gap-3">
        {FRAMEWORK_GUIDES.map((fg) => {
          const isSelected = selectedMethod === fg.id;
          return (
            <div
              key={fg.id}
              onClick={() => setSelectedMethod(fg.id)}
              className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'bg-white border-[#3c4a59] shadow-md ring-2 ring-[#3c4a59]/20'
                  : 'bg-white/60 border-gray-200 hover:bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-extrabold text-gray-900 text-sm">{fg.name}</span>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </div>
              <div className="text-[11px] font-bold text-gray-500">{fg.acronym}</div>
              <p className="text-[11px] text-gray-600 mt-2 line-clamp-2">{fg.description}</p>
            </div>
          );
        })}
      </div>

      {/* Selected Framework Deep Dive Guide */}
      <div className="glass-card p-6 space-y-5 border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
          <div>
            <h3 className="font-extrabold text-gray-900 text-base">
              {currentMethodGuide.name} Blueprint
            </h3>
            <p className="text-xs text-gray-500">Best for: {currentMethodGuide.bestFor}</p>
          </div>
          <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-full self-start">
            {currentMethodGuide.acronym}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {currentMethodGuide.steps.map((step) => (
            <div key={step.letter} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#3c4a59] text-white flex items-center justify-center font-extrabold text-xs shadow-sm">
                  {step.letter}
                </span>
                <span className="font-bold text-gray-900 text-xs">{step.name}</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">{step.desc}</p>
              <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-700 italic bg-gray-50 p-2 rounded-lg">
                "{step.example}"
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive STAR Answer Builder & Real-time Rubric */}
      <div className="glass-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Interactive STAR Response Builder & Evaluator
            </h3>
            <p className="text-xs text-gray-500">
              Draft each component of your story below. ResuV grades your structure and flags missing metrics in real-time.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLoadSample}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
            >
              Load High-Score Sample
            </button>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs font-bold text-gray-500">STAR Score:</span>
              <span
                className={`text-base font-black ${
                  totalScore >= 80 ? 'text-emerald-600' : totalScore >= 50 ? 'text-amber-600' : 'text-gray-400'
                }`}
              >
                {totalScore}%
              </span>
            </div>
          </div>
        </div>

        {/* 4 Pillar Inputs */}
        <div className="space-y-4">
          {/* Situation */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-[#3c4a59] text-white flex items-center justify-center font-bold text-xs">
                  S
                </span>
                <span className="text-xs font-bold text-gray-900">Situation (Context & Stakes)</span>
              </div>
              <span
                className={`text-[11px] font-semibold ${
                  sEval.score === 100 ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {sEval.tip}
              </span>
            </div>
            <textarea
              rows={2}
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              placeholder="Where were you working? What was the scale of the company and the severity of the bottleneck/crisis?"
              className="w-full text-xs p-3 rounded-lg border border-gray-200 focus:ring-1 focus:ring-[#3c4a59] focus:outline-none"
            />
          </div>

          {/* Task */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-[#3c4a59] text-white flex items-center justify-center font-bold text-xs">
                  T
                </span>
                <span className="text-xs font-bold text-gray-900">Task (Your Explicit Mandate)</span>
              </div>
              <span
                className={`text-[11px] font-semibold ${
                  tEval.score === 100 ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {tEval.tip}
              </span>
            </div>
            <textarea
              rows={2}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="What exact deliverable or resolution were YOU responsible for? What was the constraint?"
              className="w-full text-xs p-3 rounded-lg border border-gray-200 focus:ring-1 focus:ring-[#3c4a59] focus:outline-none"
            />
          </div>

          {/* Action */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-[#3c4a59] text-white flex items-center justify-center font-bold text-xs">
                  A
                </span>
                <span className="text-xs font-bold text-gray-900">Action (Your Hands-on Execution)</span>
              </div>
              <span
                className={`text-[11px] font-semibold ${
                  aEval.score === 100 ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {aEval.tip}
              </span>
            </div>
            <textarea
              rows={3}
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="What specific actions did YOU take? (e.g. 'I profiled the queries', 'I negotiated with Product', 'I architected the failover pipeline')."
              className="w-full text-xs p-3 rounded-lg border border-gray-200 focus:ring-1 focus:ring-[#3c4a59] focus:outline-none"
            />
          </div>

          {/* Result */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-[#3c4a59] text-white flex items-center justify-center font-bold text-xs">
                  R
                </span>
                <span className="text-xs font-bold text-gray-900">Result (Measurable Impact & Metrics)</span>
              </div>
              <span
                className={`text-[11px] font-semibold ${
                  rEval.score === 100 ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {rEval.tip}
              </span>
            </div>
            <textarea
              rows={2}
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder="What happened afterward? State exact numbers: % performance gain, $ saved, hours, customer ratings, or team awards."
              className="w-full text-xs p-3 rounded-lg border border-gray-200 focus:ring-1 focus:ring-[#3c4a59] focus:outline-none"
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-gray-100">
          <button
            onClick={() => {
              setSituation('');
              setTask('');
              setAction('');
              setResult('');
            }}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear All Fields
          </button>

          <button
            onClick={handleCopy}
            disabled={!fullCompiledAnswer}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#3c4a59] text-white hover:bg-[#2e3a47] text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied Full Story!' : 'Copy Formatted STAR Story'}
          </button>
        </div>
      </div>
    </div>
  );
}
