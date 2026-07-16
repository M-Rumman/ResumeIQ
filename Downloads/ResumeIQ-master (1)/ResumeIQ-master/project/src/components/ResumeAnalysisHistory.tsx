import { useCallback, useEffect, useState } from 'react';
import {
  History,
  CheckCircle2,
  Lightbulb,
  Target,
  Calendar,
  FileSearch,
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';

export type ResumeAnalysisRecord = {
  id: string;
  created_at: string;
  ats_score: number;
  strengths: string;
  improvements: string;
};

interface ResumeAnalysisHistoryProps {
  refreshKey?: number;
  isPro?: boolean;
  historyLimit?: number | null;
  onUpgrade?: () => void;
}

const PAGE_SIZE = 20;

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function atsScoreStyles(score: number) {
  if (score >= 80) return 'text-[#3c4a59] bg-gray-50 border-gray-200';
  if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-100';
  return 'text-red-600 bg-red-50 border-red-100';
}

function parseTextLines(text: string) {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);
}

export default function ResumeAnalysisHistory({
  refreshKey = 0,
  isPro = true,
  historyLimit = null,
  onUpgrade,
}: ResumeAnalysisHistoryProps) {
  const [analyses, setAnalyses] = useState<ResumeAnalysisRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const usePagination = historyLimit == null;

  const fetchPage = useCallback(
    async (userId: string, offset: number, append: boolean) => {
      const { count } = await supabase
        .from('resume_analysis')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      const total = count ?? 0;
      const maxRows = historyLimit ?? total;
      const effectiveTotal = Math.min(total, maxRows);

      let query = supabase
        .from('resume_analysis')
        .select('id, created_at, ats_score, strengths, improvements')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (usePagination) {
        const end = Math.min(offset + PAGE_SIZE - 1, effectiveTotal - 1);
        if (offset > end || effectiveTotal === 0) {
          if (!append) setAnalyses([]);
          setTotalCount(effectiveTotal);
          setHasMore(false);
          return { ok: true as const };
        }
        query = query.range(offset, end);
      } else if (historyLimit) {
        query = query.limit(historyLimit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        return { ok: false as const, error: fetchError.message };
      }

      const rows = data ?? [];
      setTotalCount(effectiveTotal);
      setAnalyses((prev) => (append ? [...prev, ...rows] : rows));
      setHasMore(usePagination && offset + rows.length < effectiveTotal);
      return { ok: true as const };
    },
    [historyLimit, usePagination],
  );

  useEffect(() => {
    async function loadInitial() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setLoading(false);
        setAnalyses([]);
        return;
      }

      const result = await fetchPage(user.id, 0, false);
      setLoading(false);

      if (!result.ok) {
        setError('Could not load your analysis history. Please try again.');
      }
    }

    loadInitial();
  }, [refreshKey, fetchPage]);

  async function handleLoadMore() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || loadingMore) return;

    setLoadingMore(true);
    const result = await fetchPage(user.id, analyses.length, true);
    setLoadingMore(false);

    if (!result.ok) {
      setError('Could not load more analyses. Please try again.');
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <History className="w-5 h-5 text-[#3c4a59]" />
          <span className="text-xs font-bold uppercase tracking-wide text-[#3c4a59]">Resume</span>
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900">Resume Analysis History</h2>
        <p className="text-sm text-primary mt-1">
          {isPro
            ? 'Your saved analyses, newest first.'
            : `Showing your ${historyLimit ?? 5} most recent analyses.`}
        </p>
      </div>

      {!isPro && totalCount > (historyLimit ?? 0) && onUpgrade && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-sm text-amber-900">
            {totalCount - (historyLimit ?? 0)} older analyses hidden on the Free plan.
          </p>
          <button
            type="button"
            onClick={onUpgrade}
            className="text-sm font-semibold text-[#3c4a59] hover:underline whitespace-nowrap"
          >
            Upgrade for full history →
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((key) => (
            <div
              key={key}
              className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm animate-pulse"
            >
              <div className="h-5 bg-gray-100 rounded-lg w-1/3 mb-4" />
              <div className="h-4 bg-gray-100 rounded-lg w-full mb-2" />
              <div className="h-4 bg-gray-100 rounded-lg w-5/6 mb-6" />
              <div className="h-20 bg-gray-50 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && analyses.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center shadow-sm">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileSearch className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="font-bold text-gray-900 mb-2">No analyses yet</h3>
          <p className="text-sm text-primary max-w-md mx-auto">
            Run a resume analysis from the Resume Analyzer page. Each saved analysis will appear here.
          </p>
        </div>
      )}

      {!loading && analyses.length > 0 && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {analyses.map((analysis) => {
              const strengthLines = parseTextLines(analysis.strengths);
              const improvementLines = parseTextLines(analysis.improvements);
              const scoreClass = atsScoreStyles(analysis.ats_score);

              return (
                <article
                  key={analysis.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
                >
                  <div className="px-5 sm:px-6 py-5 border-b border-gray-50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <time dateTime={analysis.created_at}>{formatDate(analysis.created_at)}</time>
                    </div>
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-bold ${scoreClass}`}
                    >
                      <Target className="w-4 h-4" />
                      ATS {analysis.ats_score}%
                    </div>
                  </div>

                  <div className="p-5 sm:px-6 flex flex-col gap-5 flex-1">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <h3 className="text-sm font-bold text-gray-900">Strengths</h3>
                      </div>
                      <ul className="space-y-2">
                        {strengthLines.map((line, index) => (
                          <li
                            key={index}
                            className="text-sm text-green-800 bg-green-50 border border-green-100 rounded-xl px-3 py-2"
                          >
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        <h3 className="text-sm font-bold text-gray-900">Improvements</h3>
                      </div>
                      <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {improvementLines.map((line, index) => (
                          <li
                            key={index}
                            className="text-sm text-gray-700 bg-amber-50/60 border border-amber-100 rounded-xl px-3 py-2"
                          >
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="text-sm font-semibold text-[#3c4a59] hover:underline disabled:opacity-60"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
