import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import BlogArticleCard from '../components/BlogArticleCard';
import { BLOG_ARTICLES, BLOG_CATEGORIES, type BlogCategory } from '../lib/blogData';
import { applyPageSeo } from '../lib/seo/applyPageSeo';
import { getPageSeo } from '../lib/seo/pageMeta';

interface BlogPageProps { onOpenArticle: (slug: string) => void; }

export default function BlogPage({ onOpenArticle }: BlogPageProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All Articles' | BlogCategory>('All Articles');
  const featured = BLOG_ARTICLES.find((article) => article.featured) ?? BLOG_ARTICLES[0];
  useEffect(() => {
    applyPageSeo('blog', getPageSeo('blog'));
  }, []);
  const visible = useMemo(() => BLOG_ARTICLES.filter((article) => {
    const terms = `${article.title} ${article.excerpt} ${article.category} ${article.tags.join(' ')}`.toLowerCase();
    return (category === 'All Articles' || article.category === category) && terms.includes(query.trim().toLowerCase());
  }), [category, query]);
  const cards = visible.filter((article) => article.slug !== featured.slug);

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 font-display text-sm font-bold uppercase tracking-[0.2em] text-[#65789c]">ResuV Journal</p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">Career Resources</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ink-secondary sm:text-lg">Learn resume writing, ATS optimization, interview preparation, career advice and job search strategies.</p>
        </div>
        <div className="mt-12"><BlogArticleCard article={featured} featured onOpen={onOpenArticle} /></div>
        <label className="relative mx-auto mt-10 block max-w-2xl">
          <span className="sr-only">Search articles</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search articles..." className="h-14 w-full rounded-full border border-[#d9e0ea] bg-white px-6 pr-14 text-sm font-medium text-ink shadow-[0_8px_25px_rgba(40,55,75,0.06)] outline-none transition focus:border-[#8495b8] focus:ring-4 focus:ring-[rgba(132,149,184,0.14)]" />
          <Search className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#65789c]" />
        </label>
        <div className="mt-7 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
          {BLOG_CATEGORIES.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-all duration-200 ${category === item ? 'bg-[#8495b8] text-white shadow-md' : 'border border-[#d9e0ea] bg-white text-ink-secondary hover:-translate-y-0.5 hover:border-[#a0aeca] hover:text-ink'}`}>{item}</button>)}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {cards.length ? <div className="grid auto-rows-auto gap-6 md:grid-cols-2 xl:grid-cols-12">
          {cards.map((article, index) => <BlogArticleCard key={article.slug} article={article} onOpen={onOpenArticle} className={index === 0 ? 'md:col-span-2 xl:col-span-6' : index % 5 === 0 ? 'xl:col-span-5' : 'xl:col-span-3'} />)}
        </div> : <div className="rounded-[28px] border border-dashed border-[#cbd5e1] bg-white px-6 py-16 text-center text-ink-secondary">No articles match that search yet.</div>}
      </section>
    </div>
  );
}
