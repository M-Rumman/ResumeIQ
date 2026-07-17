import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, FileText, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

interface DashboardAnalyticsProps {
  refreshKey?: number;
}

type Stats = {
  totalAnalyses: number;
  totalInterviewSessions: number;
  averageAts: number;
  analysesThisWeek: number;
};

export default function DashboardAnalytics({ refreshKey = 0 }: DashboardAnalyticsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [analysesRes, interviewRes] = await Promise.all([
        supabase
          .from('resume_analysis')
          .select('ats_score, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('interview_prep')
          .select('id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      type AnalysisRow = { ats_score: number; created_at: string };
      const analyses = (analysesRes.data ?? []) as AnalysisRow[];
      const interviews = interviewRes.data ?? [];
      const avg =
        analyses.length > 0
          ? Math.round(analyses.reduce((sum: number, row: AnalysisRow) => sum + row.ats_score, 0) / analyses.length)
          : 0;

      const analysesThisWeek = analyses.filter(
        (row: AnalysisRow) => new Date(row.created_at) >= weekAgo,
      ).length;

      setStats({
        totalAnalyses: analyses.length,
        totalInterviewSessions: interviews.length,
        averageAts: avg,
        analysesThisWeek,
      });
      setLoading(false);
    }

    load();
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="bg-white rounded-2xl border border-gray-100 p-5 h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      label: 'Total Analyses',
      value: stats.totalAnalyses,
      icon: FileText,
      color: 'text-[#3c4a59]',
      bg: 'bg-gray-50',
    },
    {
      label: 'Interview Sessions',
      value: stats.totalInterviewSessions,
      icon: MessageSquare,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Average ATS Score',
      value: `${stats.averageAts}%`,
      icon: TrendingUp,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Analyses (7 days)',
      value: stats.analysesThisWeek,
      icon: BarChart3,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="glass-card glass-card-interactive p-5">
          <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-3`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <p className="text-2xl font-extrabold text-gray-900">{value}</p>
          <p className="text-xs text-primary mt-1 font-medium">{label}</p>
        </div>
      ))}
    </div>
  );
}
