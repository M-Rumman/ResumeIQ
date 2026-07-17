import { useCallback, useEffect, useState } from 'react';
import {
  MessageSquare,
  Calendar,
  Users,
  Code2,
  Brain,
  Star,
  FileSearch,
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';

type InterviewQuestion = {
  question: string;
  tip: string;
};

export type InterviewPrepRecord = {
  id: string;
  created_at: string;
  job_role: string;
  hr_questions: string;
  technical_questions: string;
  behavioral_questions: string;
  star_tips: string;
};

interface InterviewPrepHistoryProps {
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

function parseQuestions(json: string): InterviewQuestion[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseStarTips(text: string) {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);
}

function QuestionList({
  label,
  icon: Icon,
  color,
  bg,
  border,
  questions,
}: {
  label: string;
  icon: typeof Users;
  color: string;
  bg: string;
  border: string;
  questions: InterviewQuestion[];
}) {
  if (questions.length === 0) return null;

  return (
    <div className={`rounded-xl border ${border} overflow-hidden`}>
      <div className={`flex items-center gap-2 px-3 py-2 ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
        <h4 className="text-xs font-bold text-gray-900">{label}</h4>
        <span className="ml-auto text-[10px] font-semibold text-gray-400">{questions.length}</span>
      </div>
      <ul className="divide-y divide-gray-50">
        {questions.map((item, index) => (
          <li key={index} className="px-3 py-2.5">
            <p className="text-sm font-medium text-gray-800">{item.question}</p>
            <p className="text-xs text-primary mt-1 leading-relaxed">{item.tip}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function InterviewPrepHistory({
  refreshKey = 0,
  isPro = true,
  historyLimit = null,
  onUpgrade,
}: InterviewPrepHistoryProps) {
  const [sessions, setSessions] = useState<InterviewPrepRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const usePagination = historyLimit == null;

  const fetchPage = useCallback(
    async (userId: string, offset: number, append: boolean) => {
      const { count } = await supabase
        .from('interview_prep')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      const total = count ?? 0;
      const maxRows = historyLimit ?? total;
      const effectiveTotal = Math.min(total, maxRows);

      let query = supabase
        .from('interview_prep')
        .select('id, created_at, job_role, hr_questions, technical_questions, behavioral_questions, star_tips')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (usePagination) {
        const end = Math.min(offset + PAGE_SIZE - 1, effectiveTotal - 1);
        if (offset > end || effectiveTotal === 0) {
          if (!append) setSessions([]);
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
      setSessions((prev) => (append ? [...prev, ...rows] : rows));
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
        setSessions([]);
        return;
      }

      const result = await fetchPage(user.id, 0, false);
      setLoading(false);

      if (!result.ok) {
        setError('Could not load your interview prep history. Please try again.');
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
    const result = await fetchPage(user.id, sessions.length, true);
    setLoadingMore(false);

    if (!result.ok) {
      setError('Could not load more sessions. Please try again.');
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-5 h-5 text-[#3c4a59]" />
          <span className="text-xs font-bold uppercase tracking-wide text-[#3c4a59]">Interview</span>
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900">Interview Prep History</h2>
        <p className="text-sm text-primary mt-1">
          {isPro
            ? 'Your full saved interview sessions, newest first.'
            : `Showing your ${historyLimit ?? 5} most recent sessions.`}
        </p>
      </div>

      {!isPro && totalCount > (historyLimit ?? 0) && onUpgrade && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-sm text-amber-900">
            {totalCount - (historyLimit ?? 0)} older sessions hidden on the Free plan.
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
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2].map((key) => (
            <div
              key={key}
              className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm animate-pulse"
            >
              <div className="h-5 bg-gray-100 rounded-lg w-2/5 mb-4" />
              <div className="h-4 bg-gray-100 rounded-lg w-full mb-2" />
              <div className="h-24 bg-gray-50 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center shadow-sm">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileSearch className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="font-bold text-gray-900 mb-2">No interview prep yet</h3>
          <p className="text-sm text-primary max-w-md mx-auto">
            Generate questions from the Interview Prep page. Each saved session will appear here.
          </p>
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {sessions.map((session) => {
              const starTips = parseStarTips(session.star_tips);

              return (
                <article
                  key={session.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
                >
                  <div className="px-5 sm:px-6 py-5 border-b border-gray-50 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900">{session.job_role}</p>
                      <div className="flex items-center gap-2 text-sm text-primary mt-1">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <time dateTime={session.created_at}>{formatDate(session.created_at)}</time>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6 flex flex-col gap-4 flex-1">
                    <QuestionList
                      label="HR Questions"
                      icon={Users}
                      color="text-[#3c4a59]"
                      bg="bg-gray-50"
                      border="border-gray-200"
                      questions={parseQuestions(session.hr_questions)}
                    />
                    <QuestionList
                      label="Technical Questions"
                      icon={Code2}
                      color="text-emerald-600"
                      bg="bg-emerald-50"
                      border="border-emerald-100"
                      questions={parseQuestions(session.technical_questions)}
                    />
                    <QuestionList
                      label="Behavioral Questions"
                      icon={Brain}
                      color="text-amber-600"
                      bg="bg-amber-50"
                      border="border-amber-100"
                      questions={parseQuestions(session.behavioral_questions)}
                    />

                    {starTips.length > 0 && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="w-4 h-4 text-[#3c4a59]" />
                          <h4 className="text-xs font-bold text-gray-900">STAR Tips</h4>
                        </div>
                        <ul className="space-y-1.5">
                          {starTips.map((tip, index) => (
                            <li key={index} className="text-xs text-gray-600 leading-relaxed">
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
