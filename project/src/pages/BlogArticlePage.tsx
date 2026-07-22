import { ArrowLeft, Clock3, CalendarDays, Tag } from 'lucide-react';
import { useEffect } from 'react';
import { getBlogArticle } from '../lib/blogData';

interface BlogArticlePageProps { slug: string; onBack: () => void; }

export default function BlogArticlePage({ slug, onBack }: BlogArticlePageProps) {
  const article = getBlogArticle(slug);
  useEffect(() => {
    if (!article) return;
    document.title = article.metaTitle;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', article.metaDescription);
  }, [article]);
  if (!article) return <div className="mx-auto max-w-3xl px-4 py-24 text-center"><h1 className="font-display text-3xl font-extrabold text-ink">Article not found</h1><button type="button" onClick={onBack} className="mt-6 text-sm font-bold text-[#65789c]">Return to Career Resources</button></div>;
  return <article className="min-h-screen bg-[#f8fafc] pb-20"><div className="mx-auto max-w-4xl px-4 pb-10 pt-10 sm:px-6 lg:px-8"><button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-[#526586] transition hover:text-ink"><ArrowLeft className="h-4 w-4" />All articles</button><p className="mt-12 text-sm font-bold uppercase tracking-[0.16em] text-[#65789c]">{article.category}</p><h1 className="mt-4 font-display text-4xl font-extrabold leading-tight text-ink sm:text-6xl">{article.title}</h1><p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-secondary">{article.excerpt}</p><div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-ink-muted"><span className="font-bold text-ink">{article.author.name}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4" />{article.readingTime}</span><span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" />{article.publishDate}</span></div><img src={article.coverImage} alt="" className="mt-10 aspect-[16/8] w-full rounded-[28px] object-cover shadow-[0_15px_40px_rgba(40,55,75,0.12)]" /><div className="mx-auto mt-12 max-w-3xl space-y-6 text-[1.05rem] leading-8 text-ink-secondary"><p>This ResuV resource is designed to help you make practical, evidence-based career decisions. Use the ideas here alongside your own experience and the specific role you are applying for.</p><p>Focus on clear examples, truthful technical detail, and the requirements that matter most for the position. Small improvements in clarity can make it much easier for a recruiter to understand your fit.</p><div className="flex flex-wrap gap-2 pt-4">{article.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[rgba(132,149,184,0.12)] px-3 py-1.5 text-xs font-bold text-[#526586]"><Tag className="h-3 w-3" />{tag}</span>)}</div></div></div></article>;
}
