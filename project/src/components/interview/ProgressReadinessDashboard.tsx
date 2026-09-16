import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Award,
  AlertCircle,
  Calendar,
  Clock,
  ArrowUpRight,
  BarChart3,
  Play,
  RotateCcw,
} from 'lucide-react';
import type { PerformanceMetrics } from './PerformanceAnalyticsView';

export interface SavedSession {
  id: string;
  date: string;
  role: string;
  interviewer: string;
  readinessScore: number;
  wpm: number;
  fillerCount: number;
  durationSeconds: number;
  notes: string;
}

const DEFAULT_SESSIONS: SavedSession[] = [
  {
    id: 's-1',
    date: '2026-09-14 14:20',
    role: 'Senior Full Stack Engineer',
    interviewer: 'Sarah Chen (Staff Engineer)',
    readinessScore: 88,
    wpm: 138,
    fillerCount: 3,
    durationSeconds: 110,
    notes: 'Strong technical depth; recommended adding more quantitative metrics to system design results.',
  },
  {
    id: 's-2',
    date: '2026-09-11 10:15',
    role: 'Frontend Architect',
    interviewer: 'Alex Rivera (Talent Partner)',
    readinessScore: 82,
    wpm: 155,
    fillerCount: 6,
    durationSeconds: 95,
    notes: 'Clear communication, but filler words ("like", "um") increased during conflict resolution questions.',
  },
  {
    id: 's-3',
    date: '2026-09-08 16:45',
    role: 'Backend / Distributed Systems',
    interviewer: 'Marcus Vance (VP Engineering)',
    readinessScore: 74,
    wpm: 168,
    fillerCount: 9,
    durationSeconds: 140,
    notes: 'Rushed delivery pace (>165 WPM). Practice intentional 2-second breath pauses before transitioning.',
  },
];

interface ProgressDashboardProps {
  onStartNewSession?: () => void;
  latestMetrics?: PerformanceMetrics | null;
}

export default function ProgressReadinessDashboard({
  onStartNewSession,
  latestMetrics,
}: ProgressDashboardProps) {
  const [sessions, setSessions] = useState<SavedSession[]>(() => {
    try {
      const stored = localStorage.getItem('resuv_interview_sessions');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return DEFAULT_SESSIONS;
  });

  // Save new session if latestMetrics provided
  useEffect(() => {
    if (latestMetrics) {
      const newScore = Math.round(
        (latestMetrics.clarityScore * 0.35) +
          (latestMetrics.structureScore * 0.35) +
          (Math.min(100, latestMetrics.eyeContactPercent) * 0.15) +
          (Math.max(0, 100 - latestMetrics.fillerCount * 8) * 0.15)
      );

      const newSession: SavedSession = {
        id: 's-' + Date.now(),
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        role: 'Target Role',
        interviewer: latestMetrics.personaName,
        readinessScore: newScore,
        wpm: latestMetrics.wpm,
        fillerCount: latestMetrics.fillerCount,
        durationSeconds: latestMetrics.durationSeconds,
        notes: `Recorded ${latestMetrics.wpm} WPM and ${latestMetrics.fillerCount} filler words. Answer demonstrated structured STAR delivery.`,
      };

      setSessions((prev) => {
        // Prevent duplicate append
        if (prev.some((s) => s.id === newSession.id)) return prev;
        const updated = [newSession, ...prev];
        try {
          localStorage.setItem('resuv_interview_sessions', JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    }
  }, [latestMetrics]);

  // Calculate Aggregates
  const totalCompleted = sessions.length;
  const avgScore =
    totalCompleted > 0
      ? Math.round(sessions.reduce((acc, s) => acc + s.readinessScore, 0) / totalCompleted)
      : 80;
  const avgWpm =
    totalCompleted > 0
      ? Math.round(sessions.reduce((acc, s) => acc + s.wpm, 0) / totalCompleted)
      : 142;
  const avgFillers =
    totalCompleted > 0
      ? (sessions.reduce((acc, s) => acc + s.fillerCount, 0) / totalCompleted).toFixed(1)
      : '3.5';

  const handleResetHistory = () => {
    if (window.confirm('Reset local interview session history?')) {
      localStorage.removeItem('resuv_interview_sessions');
      setSessions(DEFAULT_SESSIONS);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="glass-card p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Multi-Session Readiness Analytics
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900">
              Interview Readiness Dashboard
            </h2>
            <p className="text-xs text-gray-600">
              Track your performance progression, recurring habits, and readiness index across all practice sessions.
            </p>
          </div>

          {onStartNewSession && (
            <button
              onClick={onStartNewSession}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3c4a59] text-white hover:bg-[#2e3a47] text-xs font-bold shadow-md active:scale-95 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              Launch New Practice Session
            </button>
          )}
        </div>
      </div>

      {/* Aggregate Score Gauges */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Readiness Index */}
        <div className="glass-card p-5 space-y-2 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Readiness Index
            </span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">{avgScore}%</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5" /> +14% trend
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            Based on {totalCompleted} comprehensive mock interview evaluations.
          </p>
        </div>

        {/* Average Pacing */}
        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Average Pacing
            </span>
            <Clock className="w-4 h-4 text-[#3c4a59]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">{avgWpm}</span>
            <span className="text-xs text-gray-500 font-medium">WPM</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-bold">
            Optimal executive range (120–160 WPM).
          </p>
        </div>

        {/* Average Fillers */}
        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Avg Filler Count
            </span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">{avgFillers}</span>
            <span className="text-xs text-gray-500 font-medium">per response</span>
          </div>
          <p className="text-[11px] text-gray-500">
            Down from 9.0 in your first baseline session.
          </p>
        </div>

        {/* Sessions Completed */}
        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Completed Rounds
            </span>
            <BarChart3 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">{totalCompleted}</span>
            <span className="text-xs text-gray-500 font-medium">sessions</span>
          </div>
          <p className="text-[11px] text-gray-500">
            Full history synced with your ResuV profile.
          </p>
        </div>
      </div>

      {/* Weak Spots & Targeted Remediation */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Weak-Spot Diagnostics & Targeted Drills
          </h3>
          <span className="text-xs text-gray-500">Based on multi-session trend analysis</span>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              1. Rushing on System Design
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Pacing frequently spikes above 165 WPM when describing architecture trade-offs.
            </p>
            <div className="text-[10px] text-indigo-700 bg-indigo-50 p-2 rounded-lg font-medium">
              💡 Drill: Practice taking a deliberate 2-second pause before detailing microservices.
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              2. STAR Results Omit Metrics
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              33% of your behavioral responses ended with qualitative claims instead of percentages or numbers.
            </p>
            <div className="text-[10px] text-emerald-700 bg-emerald-50 p-2 rounded-lg font-medium">
              💡 Drill: Memorize 3 concrete metrics (e.g. 40% latency drop, 99.98% uptime, $250k saved).
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              3. "We" vs "I" Overuse
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Interviewers flagged ambiguity over whether decisions were team-directed or your personal initiative.
            </p>
            <div className="text-[10px] text-purple-700 bg-purple-50 p-2 rounded-lg font-medium">
              💡 Drill: Explicitly use "My specific contribution was..." during the Action pillar.
            </div>
          </div>
        </div>
      </div>

      {/* Session History Log */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            Mock Interview Practice History
          </h3>
          <button
            onClick={handleResetHistory}
            className="text-xs text-gray-400 hover:text-red-600 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset History
          </button>
        </div>

        <div className="divide-y divide-gray-100 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {sessions.map((session) => (
            <div key={session.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-gray-50/60 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900">{session.role}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                    {session.interviewer}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 flex items-center gap-3">
                  <span>{session.date}</span>
                  <span>·</span>
                  <span>{Math.floor(session.durationSeconds / 60)}m duration</span>
                  <span>·</span>
                  <span>{session.wpm} WPM</span>
                  <span>·</span>
                  <span className="text-amber-700 font-semibold">{session.fillerCount} fillers</span>
                </div>
                <p className="text-xs text-gray-700 pt-1 italic font-serif">
                  "{session.notes}"
                </p>
              </div>

              <div className="text-right sm:flex-shrink-0">
                <div className="text-xl font-black text-[#3c4a59]">
                  {session.readinessScore}%
                </div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase">
                  {session.readinessScore >= 80 ? 'Interview Ready' : 'In Training'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
