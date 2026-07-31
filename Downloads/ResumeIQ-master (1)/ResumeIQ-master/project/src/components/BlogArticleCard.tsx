import type { BlogArticle } from '../lib/blogData';

interface BlogArticleCardProps {
  article: BlogArticle;
  onOpen: (slug: string) => void;
  featured?: boolean;
  className?: string;
}

export default function BlogArticleCard({ article, onOpen, featured = false, className = '' }: BlogArticleCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(article.slug)}
      className={`group overflow-hidden rounded-[28px] border border-white/80 bg-white text-left shadow-[0_12px_35px_rgba(40,55,75,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(40,55,75,0.14)] ${className}`}
    >
      {featured ? (
        <div className="grid min-h-[500px] lg:grid-cols-5">
          <div className="order-2 flex flex-col justify-between p-7 sm:p-10 lg:order-1 lg:col-span-2">
            <div>
              <div className="mb-7 flex flex-wrap items-center gap-3 text-xs font-bold text-ink-muted">
                <span className="rounded-full bg-[rgba(132,149,184,0.14)] px-3 py-1.5 text-[#526586]">{article.category}</span>
                <span>{article.readingTime}</span><span className="h-1 w-1 rounded-full bg-[#a0aeca]" /><span>{article.publishDate}</span>
              </div>
              <h2 className="font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">{article.title}</h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-secondary">{article.excerpt}</p>
            </div>
            <div className="mt-10 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8495b8] text-xs font-extrabold text-white">{article.author.initials}</span>
              <span><span className="block text-sm font-extrabold text-ink">{article.author.name}</span><span className="block text-xs text-ink-muted">{article.author.role}</span></span>
            </div>
          </div>
          <div className="order-1 min-h-[270px] overflow-hidden lg:order-2 lg:col-span-3">
            <img src={article.coverImage} alt={article.title} decoding="async" fetchPriority="high" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="aspect-[16/10] overflow-hidden"><img src={article.coverImage} alt={article.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /></div>
          <div className="flex flex-1 flex-col p-6">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted"><span className="text-[#65789c]">{article.category}</span><span>•</span><span>{article.readingTime}</span><span>•</span><span>{article.publishDate}</span></div>
            <h2 className="mt-4 font-display text-xl font-extrabold leading-snug text-ink">{article.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{article.excerpt}</p>
          </div>
        </div>
      )}
    </button>
  );
}
