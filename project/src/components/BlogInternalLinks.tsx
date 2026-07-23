import type { BlogArticle } from '../lib/blogData';
import { BLOG_ARTICLES } from '../lib/blogData';

interface BlogInternalLinksProps {
  article: BlogArticle;
  onNavigate: (page: string) => void;
}

/** Shared, data-driven internal linking for every article. */
export default function BlogInternalLinks({ article, onNavigate }: BlogInternalLinksProps) {
  const related = BLOG_ARTICLES
    .filter((candidate) => candidate.slug !== article.slug)
    .sort((left, right) => {
      const leftOverlap = left.tags.filter((tag) => article.tags.includes(tag)).length + Number(left.category === article.category);
      const rightOverlap = right.tags.filter((tag) => article.tags.includes(tag)).length + Number(right.category === article.category);
      return rightOverlap - leftOverlap;
    })
    .slice(0, 3);

  return (
    <aside className="mx-auto mt-14 max-w-3xl space-y-8">
      <section className="rounded-[24px] border border-[#dce3ed] bg-white p-6 shadow-[0_10px_28px_rgba(40,55,75,0.06)]">
        <h2 className="font-display text-xl font-extrabold text-ink">Put this guidance into practice</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">Use ResuV’s tools to apply this article to your own experience and a specific target role.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={() => onNavigate('analyzer')} className="btn-primary px-4 py-2 text-sm">Analyze your resume</button>
          <button type="button" onClick={() => onNavigate('interview')} className="btn-ghost px-4 py-2 text-sm">Prepare for interviews</button>
          <button type="button" onClick={() => onNavigate('pricing')} className="btn-ghost px-4 py-2 text-sm">View plans</button>
        </div>
      </section>
      <section>
        <div className="flex items-end justify-between gap-4"><h2 className="font-display text-2xl font-extrabold text-ink">Related resources</h2><button type="button" onClick={() => onNavigate('blog')} className="text-sm font-bold text-[#526586] hover:text-ink">View all articles</button></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">{related.map((item) => <button key={item.slug} type="button" onClick={() => onNavigate(`blog/${item.slug}`)} className="rounded-2xl border border-[#dce3ed] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"><span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#65789c]">{item.category}</span><span className="mt-2 block text-sm font-extrabold leading-snug text-ink">{item.title}</span></button>)}</div>
      </section>
    </aside>
  );
}
